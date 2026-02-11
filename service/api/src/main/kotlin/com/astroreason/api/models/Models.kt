package com.tracefield.api.models

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

@Serializable
data class VersionInfo(
    val name: String = "tracefield-api",
    val version: String = "0.1.0"
)

@Serializable
data class IngestResponse(
    val jobId: String,
    val objectUri: String
)

@Serializable
data class JobStatusResponse(
    val id: String,
    val status: String,
    val enqueuedAt: String? = null,
    val startedAt: String? = null,
    val endedAt: String? = null,
    val excInfo: String? = null,
    val result: String? = null
)

@Serializable
data class HealthResponse(
    val status: String = "ok"
)

@Serializable
data class DatasetRequest(
    val name: String,
    val description: String? = null,
    val source: String? = null,
    val license: String? = null,
    val schema: JsonElement? = null,
    val refreshSchedule: String? = null
)

@Serializable
data class DatasetResponse(
    val id: String,
    val name: String,
    val description: String? = null,
    val source: String? = null,
    val license: String? = null,
    val schema: JsonElement? = null,
    val refreshSchedule: String? = null,
    val createdAt: String,
    val updatedAt: String
)

@Serializable
data class EntityMappingRequest(
    val datasetId: String,
    val entityId: String,
    val sourceRecordId: String? = null,
    val sourceKeys: JsonElement? = null,
    val method: String? = null,
    val score: Double? = null
)

@Serializable
data class EntityMappingResponse(
    val id: String,
    val datasetId: String,
    val entityId: String,
    val sourceRecordId: String? = null,
    val sourceKeys: JsonElement? = null,
    val method: String? = null,
    val score: Double? = null,
    val createdAt: String
)

@Serializable
data class FeatureDefinitionRequest(
    val name: String,
    val description: String? = null,
    val valueType: String,
    val unit: String? = null,
    val owner: String? = null,
    val config: JsonElement? = null
)

@Serializable
data class FeatureDefinitionResponse(
    val id: String,
    val name: String,
    val description: String? = null,
    val valueType: String,
    val unit: String? = null,
    val owner: String? = null,
    val config: JsonElement? = null,
    val createdAt: String
)

@Serializable
data class AnalysisJobRequest(
    val name: String,
    val config: JsonElement,
    val status: String? = null
)

@Serializable
data class AnalysisJobResponse(
    val id: String,
    val name: String,
    val status: String,
    val config: JsonElement,
    val createdAt: String,
    val startedAt: String? = null,
    val endedAt: String? = null
)

@Serializable
data class AnalysisResultResponse(
    val id: String,
    val jobId: String,
    val featureXId: String,
    val featureYId: String,
    val stats: JsonElement,
    val pValue: Double? = null,
    val effectSize: Double? = null,
    val correction: String? = null,
    val createdAt: String
)

@Serializable
data class RegisterRequest(
    val email: String,
    val password: String
)

@Serializable
data class LoginRequest(
    val email: String? = null,
    val username: String? = null,
    val password: String = ""
)

@Serializable
data class UserResponse(
    val id: String,
    val email: String,
    val displayName: String? = null
)

@Serializable
data class LoginStateResponse(
    val authenticated: Boolean,
    val user: UserResponse? = null
)
