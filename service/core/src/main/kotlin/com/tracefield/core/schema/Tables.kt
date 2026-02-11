package com.tracefield.core.schema

import org.jetbrains.exposed.dao.id.UUIDTable
import org.jetbrains.exposed.dao.id.LongIdTable
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.javatime.CurrentTimestamp
import org.jetbrains.exposed.sql.javatime.date
import org.jetbrains.exposed.sql.javatime.time
import org.jetbrains.exposed.sql.javatime.timestamp
import org.jetbrains.exposed.sql.statements.api.PreparedStatementApi
import org.postgresql.util.PGobject
import java.util.*

class JsonbColumnType : ColumnType() {
    override fun sqlType(): String = "JSONB"

    override fun valueFromDB(value: Any): Any = when (value) {
        is PGobject -> value.value ?: "null"
        else -> value.toString()
    }

    override fun notNullValueToDB(value: Any): Any {
        return valueToJsonb(value)
    }

    override fun setParameter(stmt: PreparedStatementApi, index: Int, value: Any?) {
        if (value == null) {
            stmt.setNull(index, this)
            return
        }

        stmt[index] = valueToJsonb(value)
    }

    private fun valueToJsonb(value: Any): PGobject {
        return when (value) {
            is PGobject -> value
            else -> PGobject().apply {
                type = "jsonb"
                this.value = value.toString()
            }
        }
    }
}

// Helper for JSONB columns
fun Table.jsonb(name: String): Column<String> = registerColumn(name, JsonbColumnType())

class VectorColumnType(private val dim: Int) : ColumnType() {
    override fun sqlType(): String = "vector($dim)"

    override fun valueFromDB(value: Any): Any = when (value) {
        is PGobject -> value.value ?: ""
        else -> value.toString()
    }

    override fun notNullValueToDB(value: Any): Any {
        return valueToVector(value)
    }

    override fun setParameter(stmt: PreparedStatementApi, index: Int, value: Any?) {
        if (value == null) {
            stmt.setNull(index, this)
            return
        }

        stmt[index] = valueToVector(value)
    }

    private fun valueToVector(value: Any): PGobject {
        return when (value) {
            is PGobject -> value
            else -> PGobject().apply {
                type = "vector"
                this.value = value.toString()
            }
        }
    }
}

// Helper for pgvector columns
fun Table.vector(name: String, dim: Int): Column<String> = registerColumn(name, VectorColumnType(dim))

object JobStatusTable : UUIDTable("job_status", columnName = "id") {
    val function = text("function")
    val status = text("status")
    val argsJson = jsonb("args_json")
    val kwargsJson = jsonb("kwargs_json")
    val enqueuedAt = long("enqueued_at")
    val startedAt = long("started_at").nullable()
    val endedAt = long("ended_at").nullable()
    val result = text("result").nullable()
    val excInfo = text("exc_info").nullable()
    val updatedAt = timestamp("updated_at").defaultExpression(CurrentTimestamp())
}

object Datasets : UUIDTable("datasets", columnName = "id") {
    val name = text("name")
    val description = text("description").nullable()
    val sourceText = text("source").nullable()
    val license = text("license").nullable()
    val schemaJson = jsonb("schema_json").nullable()
    val refreshSchedule = text("refresh_schedule").nullable()
    val createdAt = timestamp("created_at").defaultExpression(CurrentTimestamp())
    val updatedAt = timestamp("updated_at").defaultExpression(CurrentTimestamp())
}

object DatasetFiles : UUIDTable("dataset_files", columnName = "id") {
    val datasetId = uuid("dataset_id").references(Datasets.id, onDelete = ReferenceOption.CASCADE)
    val objectUri = text("object_uri")
    val filename = text("filename").nullable()
    val contentType = text("content_type").nullable()
    val sizeBytes = long("size_bytes").nullable()
    val checksum = text("checksum").nullable()
    val createdAt = timestamp("created_at").defaultExpression(CurrentTimestamp())
}

object Entities : UUIDTable("entities", columnName = "id") {
    val entityType = text("entity_type")
    val displayName = text("display_name").nullable()
    val externalIds = jsonb("external_ids").nullable()
    val createdAt = timestamp("created_at").defaultExpression(CurrentTimestamp())
    val updatedAt = timestamp("updated_at").defaultExpression(CurrentTimestamp())
}

object EntityMap : UUIDTable("entity_map", columnName = "id") {
    val datasetId = uuid("dataset_id").references(Datasets.id, onDelete = ReferenceOption.CASCADE)
    val entityId = uuid("entity_id").references(Entities.id, onDelete = ReferenceOption.CASCADE)
    val sourceRecordId = text("source_record_id").nullable()
    val sourceKeys = jsonb("source_keys").nullable()
    val method = text("method").nullable()
    val score = double("score").nullable()
    val createdAt = timestamp("created_at").defaultExpression(CurrentTimestamp())
}

object FeatureDefinitions : UUIDTable("feature_definitions", columnName = "id") {
    val name = text("name")
    val description = text("description").nullable()
    val valueType = text("value_type")
    val unit = text("unit").nullable()
    val owner = text("owner").nullable()
    val configJson = jsonb("config_json").nullable()
    val createdAt = timestamp("created_at").defaultExpression(CurrentTimestamp())
}

object Features : UUIDTable("features", columnName = "id") {
    val entityId = uuid("entity_id").references(Entities.id, onDelete = ReferenceOption.CASCADE)
    val datasetId = uuid("dataset_id")
        .references(Datasets.id, onDelete = ReferenceOption.SET_NULL)
        .nullable()
    val featureDefinitionId = uuid("feature_definition_id")
        .references(FeatureDefinitions.id, onDelete = ReferenceOption.CASCADE)
    val valueJson = jsonb("value_json").nullable()
    val valueNum = double("value_num").nullable()
    val valueText = text("value_text").nullable()
    val valueBool = bool("value_bool").nullable()
    val valueTs = timestamp("value_ts").nullable()
    val provenanceJson = jsonb("provenance_json").nullable()
    val createdAt = timestamp("created_at").defaultExpression(CurrentTimestamp())
}

object AnalysisJobs : UUIDTable("analysis_jobs", columnName = "id") {
    val name = text("name")
    val status = text("status")
    val configJson = jsonb("config_json")
    val requestedBy = uuid("requested_by").nullable()
    val createdAt = timestamp("created_at").defaultExpression(CurrentTimestamp())
    val startedAt = timestamp("started_at").nullable()
    val endedAt = timestamp("ended_at").nullable()
}

object AnalysisResults : UUIDTable("analysis_results", columnName = "id") {
    val jobId = uuid("job_id").references(AnalysisJobs.id, onDelete = ReferenceOption.CASCADE)
    val featureXId = uuid("feature_x_id").references(FeatureDefinitions.id, onDelete = ReferenceOption.CASCADE)
    val featureYId = uuid("feature_y_id").references(FeatureDefinitions.id, onDelete = ReferenceOption.CASCADE)
    val statsJson = jsonb("stats_json")
    val pValue = double("p_value").nullable()
    val effectSize = double("effect_size").nullable()
    val correction = text("correction").nullable()
    val createdAt = timestamp("created_at").defaultExpression(CurrentTimestamp())
}

object Users : UUIDTable("users", columnName = "id") {
    val email = text("email")
    val displayName = text("display_name").nullable()
    val passwordHash = text("password_hash").nullable()
    val createdAt = timestamp("created_at").defaultExpression(CurrentTimestamp())
    val updatedAt = timestamp("updated_at").defaultExpression(CurrentTimestamp())
}

object OauthIdentities : UUIDTable("oauth_identities", columnName = "id") {
    val userId = uuid("user_id").references(Users.id, onDelete = ReferenceOption.CASCADE)
    val provider = text("provider")
    val providerUserId = text("provider_user_id")
    val email = text("email").nullable()
    val accessToken = text("access_token").nullable()
    val refreshToken = text("refresh_token").nullable()
    val expiresAt = timestamp("expires_at").nullable()
    val createdAt = timestamp("created_at").defaultExpression(CurrentTimestamp())
}

object Sessions : UUIDTable("sessions", columnName = "id") {
    val userId = uuid("user_id").references(Users.id, onDelete = ReferenceOption.CASCADE)
    val createdAt = timestamp("created_at").defaultExpression(CurrentTimestamp())
    val expiresAt = timestamp("expires_at")
    val ipAddress = text("ip_address").nullable()
    val userAgent = text("user_agent").nullable()
}
