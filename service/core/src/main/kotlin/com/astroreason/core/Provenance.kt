package com.tracefield.core

import com.tracefield.core.schema.jsonb
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.javatime.CurrentTimestamp
import org.jetbrains.exposed.sql.javatime.timestamp
import org.jetbrains.exposed.sql.transactions.transaction
import kotlinx.serialization.json.*
import java.time.Instant
import java.util.*

object ProvenanceEvents : Table("provenance_event") {
    val id = long("id").autoIncrement()
    val personId = uuid("person_id").nullable()
    val entityId = uuid("entity_id").nullable()
    val datasetId = uuid("dataset_id").nullable()
    val jobId = uuid("job_id").nullable()
    val stage = text("stage")
    val detail = jsonb("detail")
    val createdAt = timestamp("created_at").defaultExpression(CurrentTimestamp())

    override val primaryKey = PrimaryKey(id)
}

data class ProvenanceEvent(
    val id: Long? = null,
    val personId: UUID? = null,
    val entityId: UUID? = null,
    val datasetId: UUID? = null,
    val jobId: UUID? = null,
    val stage: String,
    val detail: Map<String, Any>,
    val createdAt: Instant? = null
)

fun logProvenanceEvent(
    personId: UUID? = null,
    entityId: UUID? = null,
    datasetId: UUID? = null,
    jobId: UUID? = null,
    stage: String,
    status: String? = null,
    count: Int? = null,
    durationMs: Long? = null,
    error: String? = null,
    meta: Map<String, String> = emptyMap(),
    detail: Map<String, String> = emptyMap()
) {
    transaction(DatabaseManager.getDatabase()) {
        val detailJson = buildJsonObject {
            detail.forEach { (key, value) ->
                put(key, JsonPrimitive(value))
            }
            if (status != null) {
                put("status", JsonPrimitive(status))
            }
            if (count != null) {
                put("count", JsonPrimitive(count))
            }
            if (durationMs != null) {
                put("duration_ms", JsonPrimitive(durationMs))
            }
            if (error != null) {
                put("error", JsonPrimitive(error))
            }
            if (meta.isNotEmpty()) {
                put("meta", buildJsonObject {
                    meta.forEach { (key, value) ->
                        put(key, JsonPrimitive(value))
                    }
                })
            }
        }.toString()
        
        ProvenanceEvents.insert {
            it[ProvenanceEvents.personId] = personId
            it[ProvenanceEvents.entityId] = entityId
            it[ProvenanceEvents.datasetId] = datasetId
            it[ProvenanceEvents.jobId] = jobId
            it[ProvenanceEvents.stage] = stage
            it[ProvenanceEvents.detail] = detailJson
        }
    }
}
