package com.tracefield.api.jobs

import com.tracefield.core.queue.Job
import com.tracefield.core.queue.JobQueue
import com.tracefield.core.queue.JobStatus
import com.tracefield.core.queue.createJobQueue
import com.tracefield.core.Config
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

class ApiJobQueue {
    private val jobQueue: JobQueue = createJobQueue(
        Config.settings.kafkaBootstrapServers,
        "default",
        groupId = null,
        clientId = "api-producer"
    )

    private val featuresQueue: JobQueue = createJobQueue(
        Config.settings.kafkaBootstrapServers,
        "features",
        groupId = null,
        clientId = "api-features-producer"
    )

    fun getJobStatus(jobId: String): Job? {
        return jobQueue.fetch(jobId) ?: featuresQueue.fetch(jobId)
    }

    fun updateJobStatus(jobId: String, status: JobStatus, result: String? = null, excInfo: String? = null) {
        featuresQueue.updateStatus(jobId, status, result, excInfo)
        jobQueue.updateStatus(jobId, status, result, excInfo)
    }

    fun enqueueFeatureExtract(
        datasetId: String,
        textColumn: String? = null,
        textColumns: List<String>? = null,
        idColumn: String? = null
    ): Job {
        val kwargs = mutableMapOf<String, String>(
            "dataset_id" to datasetId,
        )
        textColumn?.let { kwargs["text_column"] = it }
        idColumn?.let { kwargs["id_column"] = it }
        textColumns?.let { kwargs["text_columns"] = Json.encodeToString(it) }
        return featuresQueue.enqueue(
            "embeddings.extract",
            kwargs = kwargs
        )
    }

    /** Create a scalar-extract job (API-handled; no Kafka). Poll via getJobStatus, update via updateJobStatus. */
    fun createScalarExtractJob(
        datasetId: String,
        idColumn: String,
        columnsJson: String
    ): Job {
        return featuresQueue.createJobOnly(
            "scalar.extract",
            mapOf(
                "dataset_id" to datasetId,
                "id_column" to idColumn,
                "columns" to columnsJson
            )
        )
    }
}
