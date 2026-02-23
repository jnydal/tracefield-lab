package com.tracefield.api

import com.tracefield.api.models.*
import com.tracefield.api.storage.createS3Storage
import com.tracefield.api.jobs.ApiJobQueue
import com.tracefield.core.Config
import com.tracefield.core.DatabaseManager
import com.tracefield.core.schema.*
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import io.ktor.server.application.*
import io.ktor.server.engine.*
import io.ktor.server.netty.*
import io.ktor.server.plugins.contentnegotiation.*
import io.ktor.server.plugins.cors.routing.*
import io.ktor.server.plugins.forwardedheaders.*
import io.ktor.server.plugins.origin
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.longOrNull
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import org.jetbrains.exposed.dao.id.EntityID
import java.util.*
import java.net.URI
import java.net.URLEncoder
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.nio.charset.StandardCharsets
import java.security.SecureRandom
import java.time.Instant
import javax.crypto.Mac
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec
import javax.crypto.spec.SecretKeySpec

fun main(args: Array<String>) {
    Config.initialize()
    
    embeddedServer(Netty, port = 8000, host = "0.0.0.0", module = Application::module)
        .start(wait = true)
}

private val authHttpClient: HttpClient = HttpClient.newBuilder().build()
private val jsonParser = Json { ignoreUnknownKeys = true }

private fun parseJsonElement(value: String?): JsonElement? {
    if (value.isNullOrBlank() || value == "null") return null
    return runCatching { jsonParser.parseToJsonElement(value) }.getOrNull()
}

private fun sanitizeReturnTo(value: String?): String {
    if (value.isNullOrBlank()) return "/datasets"
    return if (value.startsWith("/")) value else "/datasets"
}

private fun hmacSha256(secret: String, data: String): String {
    val mac = Mac.getInstance("HmacSHA256")
    mac.init(SecretKeySpec(secret.toByteArray(StandardCharsets.UTF_8), "HmacSHA256"))
    val raw = mac.doFinal(data.toByteArray(StandardCharsets.UTF_8))
    return Base64.getUrlEncoder().withoutPadding().encodeToString(raw)
}

private fun encodeState(secret: String, returnTo: String): String {
    val nonce = UUID.randomUUID().toString()
    val issuedAt = Instant.now().epochSecond
    val payload = listOf(returnTo, nonce, issuedAt.toString()).joinToString("|")
    val signature = hmacSha256(secret, payload)
    val full = "$payload|$signature"
    return Base64.getUrlEncoder().withoutPadding()
        .encodeToString(full.toByteArray(StandardCharsets.UTF_8))
}

private fun decodeState(secret: String, state: String): String? {
    val decoded = runCatching {
        String(Base64.getUrlDecoder().decode(state), StandardCharsets.UTF_8)
    }.getOrNull() ?: return null
    val parts = decoded.split("|")
    if (parts.size != 4) return null
    val payload = parts.take(3).joinToString("|")
    val signature = parts[3]
    if (hmacSha256(secret, payload) != signature) return null
    return sanitizeReturnTo(parts[0])
}

private fun parseUuid(value: String?): UUID? {
    if (value.isNullOrBlank()) return null
    return runCatching { UUID.fromString(value) }.getOrNull()
}

private const val PASSWORD_HASH_ITERATIONS = 120_000
private const val PASSWORD_HASH_KEY_LENGTH = 256
private const val PASSWORD_HASH_SALT_BYTES = 16

private fun isValidEmail(email: String): Boolean {
    val atIndex = email.indexOf('@')
    return atIndex > 0 && atIndex < email.length - 1
}

private fun hashPassword(password: String): String {
    val salt = ByteArray(PASSWORD_HASH_SALT_BYTES)
    SecureRandom().nextBytes(salt)
    val spec = PBEKeySpec(password.toCharArray(), salt, PASSWORD_HASH_ITERATIONS, PASSWORD_HASH_KEY_LENGTH)
    val factory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
    val hash = factory.generateSecret(spec).encoded
    val saltEncoded = Base64.getEncoder().encodeToString(salt)
    val hashEncoded = Base64.getEncoder().encodeToString(hash)
    return "pbkdf2_sha256\$${PASSWORD_HASH_ITERATIONS}\$${saltEncoded}\$${hashEncoded}"
}

private data class LoginUser(val id: UUID, val email: String, val displayName: String?, val passwordHash: String)

private fun verifyPassword(password: String, storedHash: String): Boolean {
    val parts = storedHash.split("$")
    if (parts.size != 4 || parts[0] != "pbkdf2_sha256") return false
    val iterations = parts[1].toIntOrNull() ?: return false
    val salt = runCatching { Base64.getDecoder().decode(parts[2]) }.getOrNull() ?: return false
    val expectedHash = runCatching { Base64.getDecoder().decode(parts[3]) }.getOrNull() ?: return false
    val spec = PBEKeySpec(password.toCharArray(), salt, iterations, PASSWORD_HASH_KEY_LENGTH)
    val factory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
    val actualHash = factory.generateSecret(spec).encoded
    return actualHash.contentEquals(expectedHash)
}

private fun createSession(call: ApplicationCall, settings: com.tracefield.core.Settings, userId: UUID, now: Instant) {
    val sessionId = UUID.randomUUID()
    val expiresAt = now.plusSeconds(settings.authSessionTtlHours * 3600)
    transaction(DatabaseManager.getDatabase()) {
        Sessions.insert {
            it[Sessions.id] = sessionId
            it[Sessions.userId] = userId
            it[Sessions.createdAt] = now
            it[Sessions.expiresAt] = expiresAt
            it[Sessions.ipAddress] = call.request.origin.remoteHost
            it[Sessions.userAgent] = call.request.userAgent()
        }
    }
    val maxAgeSeconds = (settings.authSessionTtlHours * 3600)
        .coerceAtMost(Int.MAX_VALUE.toLong())
        .toInt()
    val sameSite = when (settings.authCookieSameSite.lowercase()) {
        "strict" -> "Strict"
        "none" -> "None"
        else -> "Lax"
    }
    call.response.cookies.append(
        Cookie(
            name = settings.authCookieName,
            value = sessionId.toString(),
            httpOnly = true,
            secure = settings.authCookieSecure,
            maxAge = maxAgeSeconds,
            path = "/",
            domain = settings.authCookieDomain,
            extensions = mapOf("SameSite" to sameSite)
        )
    )
}

private suspend fun exchangeGoogleCode(code: String, redirectUri: String, clientId: String, clientSecret: String): JsonElement {
    val body = listOf(
        "code" to code,
        "client_id" to clientId,
        "client_secret" to clientSecret,
        "redirect_uri" to redirectUri,
        "grant_type" to "authorization_code"
    ).joinToString("&") { (key, value) ->
        "${URLEncoder.encode(key, StandardCharsets.UTF_8)}=${URLEncoder.encode(value, StandardCharsets.UTF_8)}"
    }
    val request = HttpRequest.newBuilder()
        .uri(URI.create("https://oauth2.googleapis.com/token"))
        .header("Content-Type", "application/x-www-form-urlencoded")
        .POST(HttpRequest.BodyPublishers.ofString(body))
        .build()
    val response = withContext(Dispatchers.IO) {
        authHttpClient.send(request, HttpResponse.BodyHandlers.ofString())
    }
    if (response.statusCode() !in 200..299) {
        throw IllegalStateException("Token exchange failed with ${response.statusCode()}")
    }
    return jsonParser.parseToJsonElement(response.body())
}

private suspend fun fetchGoogleUserInfo(accessToken: String): JsonElement {
    val request = HttpRequest.newBuilder()
        .uri(URI.create("https://openidconnect.googleapis.com/v1/userinfo"))
        .header("Authorization", "Bearer $accessToken")
        .GET()
        .build()
    val response = withContext(Dispatchers.IO) {
        authHttpClient.send(request, HttpResponse.BodyHandlers.ofString())
    }
    if (response.statusCode() !in 200..299) {
        throw IllegalStateException("Userinfo fetch failed with ${response.statusCode()}")
    }
    return jsonParser.parseToJsonElement(response.body())
}

fun Application.module() {
    val storage = createS3Storage()
    val jobQueue = ApiJobQueue()
    val settings = Config.settings
    
    // Ensure bucket exists on startup
    storage.ensureBucket()
    
    install(ContentNegotiation) {
        json(Json {
            prettyPrint = true
            isLenient = true
            ignoreUnknownKeys = true
        })
    }

    // Trust proxy headers so HTTPS is detected behind TLS termination
    install(XForwardedHeaders)
    
    install(CORS) {
        allowMethod(HttpMethod.Options)
        allowMethod(HttpMethod.Get)
        allowMethod(HttpMethod.Post)
        allowMethod(HttpMethod.Put)
        allowMethod(HttpMethod.Delete)
        allowHeader(HttpHeaders.ContentType)
        allowHeader(HttpHeaders.Accept)
        allowCredentials = true

        val frontendOrigin = runCatching { URI(settings.frontendBaseUrl) }.getOrNull()
        val frontendHost = frontendOrigin?.host
        val frontendScheme = frontendOrigin?.scheme ?: "http"
        if (!frontendHost.isNullOrBlank()) {
            val hostWithPort = if (frontendOrigin?.port == -1 || frontendOrigin?.port == null) {
                frontendHost
            } else {
                "$frontendHost:${frontendOrigin.port}"
            }
            allowHost(hostWithPort, schemes = listOf(frontendScheme))
        }
    }
    
    routing {
        get("/healthz") {
            call.respond(HealthResponse())
        }
        
        get("/version") {
            call.respond(VersionInfo())
        }
        
        get("/jobs/{jobId}") {
            val jobId = call.parameters["jobId"] ?: run {
                call.respond(HttpStatusCode.BadRequest, "Missing job_id")
                return@get
            }
            
            val job = jobQueue.getJobStatus(jobId) ?: run {
                call.respond(HttpStatusCode.NotFound, "Job not found")
                return@get
            }
            
            call.respond(JobStatusResponse(
                id = job.id,
                status = job.status.name.lowercase(),
                enqueuedAt = job.enqueuedAt.toString(),
                startedAt = job.startedAt?.toString(),
                endedAt = job.endedAt?.toString(),
                excInfo = job.excInfo,
                result = job.result
            ))
        }

        route("/datasets") {
            get {
                val items = transaction(DatabaseManager.getDatabase()) {
                    Datasets.selectAll().map { row ->
                        DatasetResponse(
                            id = row[Datasets.id].value.toString(),
                            name = row[Datasets.name],
                            description = row[Datasets.description],
                            source = row[Datasets.sourceText],
                            license = row[Datasets.license],
                            schema = parseJsonElement(row[Datasets.schemaJson]),
                            refreshSchedule = row[Datasets.refreshSchedule],
                            createdAt = row[Datasets.createdAt].toString(),
                            updatedAt = row[Datasets.updatedAt].toString()
                        )
                    }
                }
                call.respond(items)
            }
            post {
                val req = call.receive<DatasetRequest>()
                val id = UUID.randomUUID()
                val now = Instant.now()
                transaction(DatabaseManager.getDatabase()) {
                    Datasets.insert {
                        it[Datasets.id] = id
                        it[Datasets.name] = req.name
                        it[Datasets.description] = req.description
                        it[Datasets.sourceText] = req.source
                        it[Datasets.license] = req.license
                        it[Datasets.schemaJson] = req.schema?.toString()
                        it[Datasets.refreshSchedule] = req.refreshSchedule
                        it[Datasets.createdAt] = now
                        it[Datasets.updatedAt] = now
                    }
                }
                call.respond(
                    DatasetResponse(
                        id = id.toString(),
                        name = req.name,
                        description = req.description,
                        source = req.source,
                        license = req.license,
                        schema = req.schema,
                        refreshSchedule = req.refreshSchedule,
                        createdAt = now.toString(),
                        updatedAt = now.toString()
                    )
                )
            }
            get("/{id}") {
                val id = parseUuid(call.parameters["id"]) ?: run {
                    call.respond(HttpStatusCode.BadRequest, "Invalid dataset id")
                    return@get
                }
                val dataset = transaction(DatabaseManager.getDatabase()) {
                    Datasets.select { Datasets.id eq EntityID(id, Datasets) }.singleOrNull()?.let { row ->
                        DatasetResponse(
                            id = row[Datasets.id].value.toString(),
                            name = row[Datasets.name],
                            description = row[Datasets.description],
                            source = row[Datasets.sourceText],
                            license = row[Datasets.license],
                            schema = parseJsonElement(row[Datasets.schemaJson]),
                            refreshSchedule = row[Datasets.refreshSchedule],
                            createdAt = row[Datasets.createdAt].toString(),
                            updatedAt = row[Datasets.updatedAt].toString()
                        )
                    }
                }
                if (dataset == null) {
                    call.respond(HttpStatusCode.NotFound, "Dataset not found")
                    return@get
                }
                call.respond(dataset)
            }
            put("/{id}") {
                val id = parseUuid(call.parameters["id"]) ?: run {
                    call.respond(HttpStatusCode.BadRequest, "Invalid dataset id")
                    return@put
                }
                val req = call.receive<DatasetRequest>()
                val now = Instant.now()
                val updated = transaction(DatabaseManager.getDatabase()) {
                    val existing = Datasets.select { Datasets.id eq EntityID(id, Datasets) }.singleOrNull()
                        ?: return@transaction null
                    Datasets.update({ Datasets.id eq EntityID(id, Datasets) }) {
                        it[name] = req.name
                        it[description] = req.description
                        it[Datasets.sourceText] = req.source
                        it[license] = req.license
                        it[schemaJson] = req.schema?.toString()
                        it[refreshSchedule] = req.refreshSchedule
                        it[updatedAt] = now
                    }
                    existing
                }
                if (updated == null) {
                    call.respond(HttpStatusCode.NotFound, "Dataset not found")
                    return@put
                }
                call.respond(
                    DatasetResponse(
                        id = id.toString(),
                        name = req.name,
                        description = req.description,
                        source = req.source,
                        license = req.license,
                        schema = req.schema,
                        refreshSchedule = req.refreshSchedule,
                        createdAt = updated[Datasets.createdAt].toString(),
                        updatedAt = now.toString()
                    )
                )
            }
            delete("/{id}") {
                val id = parseUuid(call.parameters["id"]) ?: run {
                    call.respond(HttpStatusCode.BadRequest, "Invalid dataset id")
                    return@delete
                }
                val datasetEntityId = EntityID(id, Datasets)
                val deleted = transaction(DatabaseManager.getDatabase()) {
                    Datasets.deleteWhere {
                        SqlExpressionBuilder.run { Datasets.id eq datasetEntityId }
                    }
                }
                if (deleted == 0) {
                    call.respond(HttpStatusCode.NotFound, "Dataset not found")
                    return@delete
                }
                call.respond(HttpStatusCode.NoContent)
            }
        }

        route("/entity-mappings") {
            get {
                val items = transaction(DatabaseManager.getDatabase()) {
                    EntityMap.selectAll().map { row ->
                        EntityMappingResponse(
                            id = row[EntityMap.id].value.toString(),
                            datasetId = row[EntityMap.datasetId].toString(),
                            entityId = row[EntityMap.entityId].toString(),
                            sourceRecordId = row[EntityMap.sourceRecordId],
                            sourceKeys = parseJsonElement(row[EntityMap.sourceKeys]),
                            method = row[EntityMap.method],
                            score = row[EntityMap.score],
                            createdAt = row[EntityMap.createdAt].toString()
                        )
                    }
                }
                call.respond(items)
            }
            post {
                val req = call.receive<EntityMappingRequest>()
                val datasetId = parseUuid(req.datasetId) ?: run {
                    call.respond(HttpStatusCode.BadRequest, "Invalid datasetId")
                    return@post
                }
                val entityId = parseUuid(req.entityId) ?: run {
                    call.respond(HttpStatusCode.BadRequest, "Invalid entityId")
                    return@post
                }
                val id = UUID.randomUUID()
                val createdAt = Instant.now()
                transaction(DatabaseManager.getDatabase()) {
                    EntityMap.insert {
                        it[EntityMap.id] = id
                        it[EntityMap.datasetId] = datasetId
                        it[EntityMap.entityId] = entityId
                        it[EntityMap.sourceRecordId] = req.sourceRecordId
                        it[EntityMap.sourceKeys] = req.sourceKeys?.toString()
                        it[EntityMap.method] = req.method
                        it[EntityMap.score] = req.score
                        it[EntityMap.createdAt] = createdAt
                    }
                }
                call.respond(
                    EntityMappingResponse(
                        id = id.toString(),
                        datasetId = datasetId.toString(),
                        entityId = entityId.toString(),
                        sourceRecordId = req.sourceRecordId,
                        sourceKeys = req.sourceKeys,
                        method = req.method,
                        score = req.score,
                        createdAt = createdAt.toString()
                    )
                )
            }
            get("/{id}") {
                val id = parseUuid(call.parameters["id"]) ?: run {
                    call.respond(HttpStatusCode.BadRequest, "Invalid mapping id")
                    return@get
                }
                val mapping = transaction(DatabaseManager.getDatabase()) {
                    EntityMap.select { EntityMap.id eq EntityID(id, EntityMap) }.singleOrNull()?.let { row ->
                        EntityMappingResponse(
                            id = row[EntityMap.id].value.toString(),
                            datasetId = row[EntityMap.datasetId].toString(),
                            entityId = row[EntityMap.entityId].toString(),
                            sourceRecordId = row[EntityMap.sourceRecordId],
                            sourceKeys = parseJsonElement(row[EntityMap.sourceKeys]),
                            method = row[EntityMap.method],
                            score = row[EntityMap.score],
                            createdAt = row[EntityMap.createdAt].toString()
                        )
                    }
                }
                if (mapping == null) {
                    call.respond(HttpStatusCode.NotFound, "Mapping not found")
                    return@get
                }
                call.respond(mapping)
            }
            put("/{id}") {
                val id = parseUuid(call.parameters["id"]) ?: run {
                    call.respond(HttpStatusCode.BadRequest, "Invalid mapping id")
                    return@put
                }
                val req = call.receive<EntityMappingRequest>()
                val datasetId = parseUuid(req.datasetId) ?: run {
                    call.respond(HttpStatusCode.BadRequest, "Invalid datasetId")
                    return@put
                }
                val entityId = parseUuid(req.entityId) ?: run {
                    call.respond(HttpStatusCode.BadRequest, "Invalid entityId")
                    return@put
                }
                val updated = transaction(DatabaseManager.getDatabase()) {
                    val existing = EntityMap.select { EntityMap.id eq EntityID(id, EntityMap) }.singleOrNull()
                        ?: return@transaction null
                    EntityMap.update({ EntityMap.id eq EntityID(id, EntityMap) }) {
                        it[EntityMap.datasetId] = datasetId
                        it[EntityMap.entityId] = entityId
                        it[EntityMap.sourceRecordId] = req.sourceRecordId
                        it[EntityMap.sourceKeys] = req.sourceKeys?.toString()
                        it[EntityMap.method] = req.method
                        it[EntityMap.score] = req.score
                    }
                    existing
                }
                if (updated == null) {
                    call.respond(HttpStatusCode.NotFound, "Mapping not found")
                    return@put
                }
                call.respond(
                    EntityMappingResponse(
                        id = id.toString(),
                        datasetId = datasetId.toString(),
                        entityId = entityId.toString(),
                        sourceRecordId = req.sourceRecordId,
                        sourceKeys = req.sourceKeys,
                        method = req.method,
                        score = req.score,
                        createdAt = updated[EntityMap.createdAt].toString()
                    )
                )
            }
            delete("/{id}") {
                val id = parseUuid(call.parameters["id"]) ?: run {
                    call.respond(HttpStatusCode.BadRequest, "Invalid mapping id")
                    return@delete
                }
                val mappingEntityId = EntityID(id, EntityMap)
                val deleted = transaction(DatabaseManager.getDatabase()) {
                    EntityMap.deleteWhere {
                        SqlExpressionBuilder.run { EntityMap.id eq mappingEntityId }
                    }
                }
                if (deleted == 0) {
                    call.respond(HttpStatusCode.NotFound, "Mapping not found")
                    return@delete
                }
                call.respond(HttpStatusCode.NoContent)
            }
        }

        route("/features/definitions") {
            get {
                val items = transaction(DatabaseManager.getDatabase()) {
                    FeatureDefinitions.selectAll().map { row ->
                        FeatureDefinitionResponse(
                            id = row[FeatureDefinitions.id].value.toString(),
                            name = row[FeatureDefinitions.name],
                            description = row[FeatureDefinitions.description],
                            valueType = row[FeatureDefinitions.valueType],
                            unit = row[FeatureDefinitions.unit],
                            owner = row[FeatureDefinitions.owner],
                            config = parseJsonElement(row[FeatureDefinitions.configJson]),
                            createdAt = row[FeatureDefinitions.createdAt].toString()
                        )
                    }
                }
                call.respond(items)
            }
            post {
                val req = call.receive<FeatureDefinitionRequest>()
                val id = UUID.randomUUID()
                val createdAt = Instant.now()
                transaction(DatabaseManager.getDatabase()) {
                    FeatureDefinitions.insert {
                        it[FeatureDefinitions.id] = id
                        it[FeatureDefinitions.name] = req.name
                        it[FeatureDefinitions.description] = req.description
                        it[FeatureDefinitions.valueType] = req.valueType
                        it[FeatureDefinitions.unit] = req.unit
                        it[FeatureDefinitions.owner] = req.owner
                        it[FeatureDefinitions.configJson] = req.config?.toString()
                        it[FeatureDefinitions.createdAt] = createdAt
                    }
                }
                call.respond(
                    FeatureDefinitionResponse(
                        id = id.toString(),
                        name = req.name,
                        description = req.description,
                        valueType = req.valueType,
                        unit = req.unit,
                        owner = req.owner,
                        config = req.config,
                        createdAt = createdAt.toString()
                    )
                )
            }
            get("/{id}") {
                val id = parseUuid(call.parameters["id"]) ?: run {
                    call.respond(HttpStatusCode.BadRequest, "Invalid feature definition id")
                    return@get
                }
                val feature = transaction(DatabaseManager.getDatabase()) {
                    FeatureDefinitions.select { FeatureDefinitions.id eq EntityID(id, FeatureDefinitions) }
                        .singleOrNull()
                        ?.let { row ->
                        FeatureDefinitionResponse(
                            id = row[FeatureDefinitions.id].value.toString(),
                            name = row[FeatureDefinitions.name],
                            description = row[FeatureDefinitions.description],
                            valueType = row[FeatureDefinitions.valueType],
                            unit = row[FeatureDefinitions.unit],
                            owner = row[FeatureDefinitions.owner],
                            config = parseJsonElement(row[FeatureDefinitions.configJson]),
                            createdAt = row[FeatureDefinitions.createdAt].toString()
                        )
                    }
                }
                if (feature == null) {
                    call.respond(HttpStatusCode.NotFound, "Feature definition not found")
                    return@get
                }
                call.respond(feature)
            }
            put("/{id}") {
                val id = parseUuid(call.parameters["id"]) ?: run {
                    call.respond(HttpStatusCode.BadRequest, "Invalid feature definition id")
                    return@put
                }
                val req = call.receive<FeatureDefinitionRequest>()
                val updated = transaction(DatabaseManager.getDatabase()) {
                    val existing = FeatureDefinitions.select { FeatureDefinitions.id eq EntityID(id, FeatureDefinitions) }
                        .singleOrNull()
                        ?: return@transaction null
                    FeatureDefinitions.update({ FeatureDefinitions.id eq EntityID(id, FeatureDefinitions) }) {
                        it[name] = req.name
                        it[description] = req.description
                        it[valueType] = req.valueType
                        it[unit] = req.unit
                        it[owner] = req.owner
                        it[configJson] = req.config?.toString()
                    }
                    existing
                }
                if (updated == null) {
                    call.respond(HttpStatusCode.NotFound, "Feature definition not found")
                    return@put
                }
                call.respond(
                    FeatureDefinitionResponse(
                        id = id.toString(),
                        name = req.name,
                        description = req.description,
                        valueType = req.valueType,
                        unit = req.unit,
                        owner = req.owner,
                        config = req.config,
                        createdAt = updated[FeatureDefinitions.createdAt].toString()
                    )
                )
            }
            delete("/{id}") {
                val id = parseUuid(call.parameters["id"]) ?: run {
                    call.respond(HttpStatusCode.BadRequest, "Invalid feature definition id")
                    return@delete
                }
                val definitionEntityId = EntityID(id, FeatureDefinitions)
                val deleted = transaction(DatabaseManager.getDatabase()) {
                    FeatureDefinitions.deleteWhere {
                        SqlExpressionBuilder.run { FeatureDefinitions.id eq definitionEntityId }
                    }
                }
                if (deleted == 0) {
                    call.respond(HttpStatusCode.NotFound, "Feature definition not found")
                    return@delete
                }
                call.respond(HttpStatusCode.NoContent)
            }
        }

        route("/analysis-jobs") {
            get {
                val items = transaction(DatabaseManager.getDatabase()) {
                    AnalysisJobs.selectAll().orderBy(AnalysisJobs.createdAt, SortOrder.DESC).map { row ->
                        AnalysisJobResponse(
                            id = row[AnalysisJobs.id].value.toString(),
                            name = row[AnalysisJobs.name],
                            status = row[AnalysisJobs.status],
                            config = parseJsonElement(row[AnalysisJobs.configJson]) ?: jsonParser.parseToJsonElement("{}"),
                            createdAt = row[AnalysisJobs.createdAt].toString(),
                            startedAt = row[AnalysisJobs.startedAt]?.toString(),
                            endedAt = row[AnalysisJobs.endedAt]?.toString()
                        )
                    }
                }
                call.respond(items)
            }
            post {
                val req = call.receive<AnalysisJobRequest>()
                val id = UUID.randomUUID()
                val status = req.status ?: "queued"
                val createdAt = Instant.now()
                transaction(DatabaseManager.getDatabase()) {
                    AnalysisJobs.insert {
                        it[AnalysisJobs.id] = id
                        it[AnalysisJobs.name] = req.name
                        it[AnalysisJobs.status] = status
                        it[AnalysisJobs.configJson] = req.config.toString()
                        it[AnalysisJobs.createdAt] = createdAt
                    }
                }
                call.respond(
                    AnalysisJobResponse(
                        id = id.toString(),
                        name = req.name,
                        status = status,
                        config = req.config,
                        createdAt = createdAt.toString()
                    )
                )
            }
            get("/{id}") {
                val id = parseUuid(call.parameters["id"]) ?: run {
                    call.respond(HttpStatusCode.BadRequest, "Invalid analysis job id")
                    return@get
                }
                val job = transaction(DatabaseManager.getDatabase()) {
                    AnalysisJobs.select { AnalysisJobs.id eq EntityID(id, AnalysisJobs) }.singleOrNull()?.let { row ->
                        AnalysisJobResponse(
                            id = row[AnalysisJobs.id].value.toString(),
                            name = row[AnalysisJobs.name],
                            status = row[AnalysisJobs.status],
                            config = parseJsonElement(row[AnalysisJobs.configJson]) ?: jsonParser.parseToJsonElement("{}"),
                            createdAt = row[AnalysisJobs.createdAt].toString(),
                            startedAt = row[AnalysisJobs.startedAt]?.toString(),
                            endedAt = row[AnalysisJobs.endedAt]?.toString()
                        )
                    }
                }
                if (job == null) {
                    call.respond(HttpStatusCode.NotFound, "Analysis job not found")
                    return@get
                }
                call.respond(job)
            }
        }

        get("/analysis-results") {
            val jobId = parseUuid(call.request.queryParameters["jobId"])
            val results = transaction(DatabaseManager.getDatabase()) {
                val query = when (jobId) {
                    null -> AnalysisResults.selectAll()
                    else -> AnalysisResults.select { AnalysisResults.jobId eq jobId }
                }
                query.map { row ->
                    AnalysisResultResponse(
                        id = row[AnalysisResults.id].value.toString(),
                        jobId = row[AnalysisResults.jobId].toString(),
                        featureXId = row[AnalysisResults.featureXId].toString(),
                        featureYId = row[AnalysisResults.featureYId].toString(),
                        stats = parseJsonElement(row[AnalysisResults.statsJson]) ?: jsonParser.parseToJsonElement("{}"),
                        pValue = row[AnalysisResults.pValue],
                        effectSize = row[AnalysisResults.effectSize],
                        correction = row[AnalysisResults.correction],
                        createdAt = row[AnalysisResults.createdAt].toString()
                    )
                }
            }
            call.respond(results)
        }

        route("/resolution/jobs") {
            get {
                val items = transaction(DatabaseManager.getDatabase()) {
                    ResolutionJobs.selectAll().orderBy(ResolutionJobs.createdAt, SortOrder.DESC).map { row ->
                        ResolutionJobResponse(
                            id = row[ResolutionJobs.id].value.toString(),
                            name = row[ResolutionJobs.name],
                            status = row[ResolutionJobs.status],
                            datasetId = row[ResolutionJobs.datasetId].toString(),
                            entityType = row[ResolutionJobs.entityType],
                            config = parseJsonElement(row[ResolutionJobs.configJson]) ?: jsonParser.parseToJsonElement("{}"),
                            createdAt = row[ResolutionJobs.createdAt].toString(),
                            startedAt = row[ResolutionJobs.startedAt]?.toString(),
                            endedAt = row[ResolutionJobs.endedAt]?.toString(),
                            resultSummary = parseJsonElement(row[ResolutionJobs.resultSummary]),
                            excInfo = row[ResolutionJobs.excInfo]
                        )
                    }
                }
                call.respond(items)
            }
            post {
                val req = call.receive<ResolutionJobRequest>()
                val datasetId = parseUuid(req.datasetId) ?: run {
                    call.respond(HttpStatusCode.BadRequest, "Invalid datasetId")
                    return@post
                }
                val id = UUID.randomUUID()
                val status = "queued"
                val createdAt = Instant.now()
                transaction(DatabaseManager.getDatabase()) {
                    ResolutionJobs.insert {
                        it[ResolutionJobs.id] = id
                        it[ResolutionJobs.name] = req.name
                        it[ResolutionJobs.status] = status
                        it[ResolutionJobs.configJson] = req.config.toString()
                        it[ResolutionJobs.datasetId] = datasetId
                        it[ResolutionJobs.entityType] = req.entityType
                        it[ResolutionJobs.createdAt] = createdAt
                    }
                }
                call.respond(
                    ResolutionJobResponse(
                        id = id.toString(),
                        name = req.name,
                        status = status,
                        datasetId = req.datasetId,
                        entityType = req.entityType,
                        config = req.config,
                        createdAt = createdAt.toString()
                    )
                )
            }
            get("/{id}") {
                val id = parseUuid(call.parameters["id"]) ?: run {
                    call.respond(HttpStatusCode.BadRequest, "Invalid resolution job id")
                    return@get
                }
                val job = transaction(DatabaseManager.getDatabase()) {
                    ResolutionJobs.select { ResolutionJobs.id eq EntityID(id, ResolutionJobs) }.singleOrNull()?.let { row ->
                        ResolutionJobResponse(
                            id = row[ResolutionJobs.id].value.toString(),
                            name = row[ResolutionJobs.name],
                            status = row[ResolutionJobs.status],
                            datasetId = row[ResolutionJobs.datasetId].toString(),
                            entityType = row[ResolutionJobs.entityType],
                            config = parseJsonElement(row[ResolutionJobs.configJson]) ?: jsonParser.parseToJsonElement("{}"),
                            createdAt = row[ResolutionJobs.createdAt].toString(),
                            startedAt = row[ResolutionJobs.startedAt]?.toString(),
                            endedAt = row[ResolutionJobs.endedAt]?.toString(),
                            resultSummary = parseJsonElement(row[ResolutionJobs.resultSummary]),
                            excInfo = row[ResolutionJobs.excInfo]
                        )
                    }
                }
                if (job == null) {
                    call.respond(HttpStatusCode.NotFound, "Resolution job not found")
                    return@get
                }
                call.respond(job)
            }
        }

        get("/auth/loginstate") {
            val sessionId = parseUuid(call.request.cookies[settings.authCookieName])
            if (sessionId == null) {
                call.respond(LoginStateResponse(authenticated = false))
                return@get
            }
            val now = Instant.now()
            val user = transaction(DatabaseManager.getDatabase()) {
                val row = Sessions
                    .innerJoin(Users, { Sessions.userId }, { Users.id })
                        .select { (Sessions.id eq EntityID(sessionId, Sessions)) and (Sessions.expiresAt greater now) }
                    .singleOrNull()
                row?.let {
                    UserResponse(
                        id = it[Users.id].value.toString(),
                        email = it[Users.email],
                        displayName = it[Users.displayName]
                    )
                }
            }
            if (user == null) {
                val sessionEntityId = EntityID(sessionId, Sessions)
                transaction(DatabaseManager.getDatabase()) {
                    Sessions.deleteWhere {
                        SqlExpressionBuilder.run { Sessions.id eq sessionEntityId }
                    }
                }
                call.respond(LoginStateResponse(authenticated = false))
                return@get
            }
            call.respond(LoginStateResponse(authenticated = true, user = user))
        }

        get("/auth/google/start") {
            val returnTo = sanitizeReturnTo(call.request.queryParameters["returnTo"])
            val state = encodeState(settings.authStateSecret, returnTo)
            val params = listOf(
                "client_id" to settings.googleClientId,
                "redirect_uri" to settings.googleRedirectUri,
                "response_type" to "code",
                "scope" to "openid email profile",
                "state" to state
            ).joinToString("&") { (key, value) ->
                "${URLEncoder.encode(key, StandardCharsets.UTF_8)}=${URLEncoder.encode(value, StandardCharsets.UTF_8)}"
            }
            val redirectUrl = "https://accounts.google.com/o/oauth2/v2/auth?$params"
            call.respondRedirect(redirectUrl)
        }

        get("/auth/google/callback") {
            val code = call.request.queryParameters["code"]
            val stateParam = call.request.queryParameters["state"]
            if (code.isNullOrBlank() || stateParam.isNullOrBlank()) {
                call.respond(HttpStatusCode.BadRequest, "Missing code or state")
                return@get
            }
            val returnTo = decodeState(settings.authStateSecret, stateParam) ?: "/"
            val tokenJson = exchangeGoogleCode(
                code = code,
                redirectUri = settings.googleRedirectUri,
                clientId = settings.googleClientId,
                clientSecret = settings.googleClientSecret
            )
            val tokenObj = tokenJson.jsonObject
            val accessToken = tokenObj["access_token"]?.jsonPrimitive?.contentOrNull
            val refreshToken = tokenObj["refresh_token"]?.jsonPrimitive?.contentOrNull
            val expiresIn = tokenObj["expires_in"]?.jsonPrimitive?.longOrNull
            if (accessToken.isNullOrBlank()) {
                call.respond(HttpStatusCode.BadRequest, "Missing access token from Google")
                return@get
            }
            val userInfo = fetchGoogleUserInfo(accessToken).jsonObject
            val providerUserId = userInfo["sub"]?.jsonPrimitive?.contentOrNull
            val email = userInfo["email"]?.jsonPrimitive?.contentOrNull
            val displayName = userInfo["name"]?.jsonPrimitive?.contentOrNull
            if (providerUserId.isNullOrBlank() || email.isNullOrBlank()) {
                call.respond(HttpStatusCode.BadRequest, "Google profile missing required fields")
                return@get
            }

            val now = Instant.now()
            val userId = transaction(DatabaseManager.getDatabase()) {
                val existing = OauthIdentities.select {
                    (OauthIdentities.provider eq "google") and (OauthIdentities.providerUserId eq providerUserId)
                }.singleOrNull()
                if (existing != null) {
                    val userId = existing[OauthIdentities.userId]
                    OauthIdentities.update({ OauthIdentities.id eq existing[OauthIdentities.id] }) {
                        it[OauthIdentities.email] = email
                        it[OauthIdentities.accessToken] = accessToken
                        it[OauthIdentities.refreshToken] = refreshToken
                        it[OauthIdentities.expiresAt] = expiresIn?.let { now.plusSeconds(it) }
                    }
                    userId
                } else {
                    val newUserId = UUID.randomUUID()
                    Users.insert {
                        it[Users.id] = newUserId
                        it[Users.email] = email
                        it[Users.displayName] = displayName
                        it[Users.createdAt] = now
                        it[Users.updatedAt] = now
                    }
                    OauthIdentities.insert {
                        it[OauthIdentities.id] = UUID.randomUUID()
                        it[OauthIdentities.userId] = newUserId
                        it[OauthIdentities.provider] = "google"
                        it[OauthIdentities.providerUserId] = providerUserId
                        it[OauthIdentities.email] = email
                        it[OauthIdentities.accessToken] = accessToken
                        it[OauthIdentities.refreshToken] = refreshToken
                        it[OauthIdentities.expiresAt] = expiresIn?.let { now.plusSeconds(it) }
                        it[OauthIdentities.createdAt] = now
                    }
                    newUserId
                }
            }

            createSession(call, settings, userId, now)
            val frontendBaseUrl = settings.frontendBaseUrl.trimEnd('/')
            call.respondRedirect("$frontendBaseUrl$returnTo")
        }

        post("/user/logout") {
            val sessionId = parseUuid(call.request.cookies[settings.authCookieName])
            if (sessionId != null) {
                val sessionEntityId = EntityID(sessionId, Sessions)
                transaction(DatabaseManager.getDatabase()) {
                    Sessions.deleteWhere {
                        SqlExpressionBuilder.run { Sessions.id eq sessionEntityId }
                    }
                }
            }
            call.response.cookies.append(
                Cookie(
                    name = settings.authCookieName,
                    value = "",
                    maxAge = 0,
                    path = "/",
                    domain = settings.authCookieDomain
                )
            )
            call.respond(mapOf("status" to "ok"))
        }

        post("/user/register") {
            try {
                val payload = runCatching { call.receive<RegisterRequest>() }.getOrElse {
                    call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Invalid request payload"))
                    return@post
                }
                val email = payload.email.trim().lowercase()
                val password = payload.password

                if (email.isBlank() || !isValidEmail(email) || password.isBlank()) {
                    call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Email and password are required"))
                    return@post
                }

                val now = Instant.now()
                val passwordHash = hashPassword(password)
                val userId = transaction(DatabaseManager.getDatabase()) {
                    val existing = Users.select { Users.email eq email }.singleOrNull()
                    if (existing != null) {
                        return@transaction null
                    }
                    val newUserId = UUID.randomUUID()
                    Users.insert {
                        it[Users.id] = newUserId
                        it[Users.email] = email
                        it[Users.displayName] = null
                        it[Users.passwordHash] = passwordHash
                        it[Users.createdAt] = now
                        it[Users.updatedAt] = now
                    }
                    newUserId
                }

                if (userId == null) {
                    call.respond(HttpStatusCode.Conflict, mapOf("error" to "User already exists"))
                    return@post
                }

                createSession(call, settings, userId, now)
                call.respond(UserResponse(id = userId.toString(), email = email, displayName = null))
            } catch (e: Throwable) {
                call.application.log.error("Register failed", e)
                call.respond(HttpStatusCode.InternalServerError, mapOf("error" to "Server error. Please try again later."))
            }
        }

        post("/user/login") {
            try {
                val payload = runCatching { call.receive<LoginRequest>() }.getOrElse {
                    call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Invalid request payload"))
                    return@post
                }
                val identifier = (payload.email ?: payload.username)?.trim()?.lowercase()
                val password = payload.password
                if (identifier.isNullOrBlank() || password.isBlank()) {
                    call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Email/username and password are required"))
                    return@post
                }
                // Look up by email (username is treated as email for now)
                val loginUser = transaction(DatabaseManager.getDatabase()) {
                    val row = Users.select { Users.email eq identifier }.singleOrNull()
                    if (row == null) return@transaction null
                    val hash = row[Users.passwordHash]
                    if (hash == null) return@transaction null
                    LoginUser(
                        row[Users.id].value,
                        row[Users.email],
                        row[Users.displayName],
                        hash
                    )
                } ?: run {
                    call.respond(HttpStatusCode.Unauthorized, mapOf("error" to "Invalid email/username or password"))
                    return@post
                }
                if (!verifyPassword(password, loginUser.passwordHash)) {
                    call.respond(HttpStatusCode.Unauthorized, mapOf("error" to "Invalid email/username or password"))
                    return@post
                }
                val now = Instant.now()
                createSession(call, settings, loginUser.id, now)
                call.respond(UserResponse(id = loginUser.id.toString(), email = loginUser.email, displayName = loginUser.displayName))
            } catch (e: Throwable) {
                call.application.log.error("Login failed", e)
                call.respond(HttpStatusCode.InternalServerError, mapOf("error" to "Server error. Please try again later."))
            }
        }

    }
}
