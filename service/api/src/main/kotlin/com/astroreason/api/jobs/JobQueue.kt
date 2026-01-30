package com.tracefield.api.jobs

import com.tracefield.core.queue.Job
import com.tracefield.core.queue.JobQueue
import com.tracefield.core.queue.createJobQueue
import com.tracefield.core.Config

class ApiJobQueue {
    private val jobQueue: JobQueue = createJobQueue(
        Config.settings.kafkaBootstrapServers,
        "default",
        groupId = null,
        clientId = "api-producer"
    )

    fun getJobStatus(jobId: String): Job? {
        return jobQueue.fetch(jobId)
    }
}
