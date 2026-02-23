package com.tracefield.api.llm

import com.tracefield.core.Config
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import org.slf4j.LoggerFactory
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration

private val log = LoggerFactory.getLogger("com.tracefield.api.llm.LlmClient")

@Serializable
private data class OllamaGenerateRequest(
    val model: String,
    val prompt: String,
    val stream: Boolean = false
)

@Serializable
private data class OllamaGenerateResponse(
    val response: String? = null,
    val error: String? = null
)

class LlmClient(
    private val baseUrl: String,
    private val model: String
) {
    private val httpClient = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(10))
        .build()

    suspend fun invokeSchemaInfer(sampleText: String, format: String): String? = withContext(Dispatchers.IO) {
        val truncated = sampleText.take(8000)
        val prompt = buildSchemaInferPrompt(truncated, format)
        val body = Json.encodeToString(
            OllamaGenerateRequest.serializer(),
            OllamaGenerateRequest(model = model, prompt = prompt, stream = false)
        )
        val request = HttpRequest.newBuilder()
            .uri(URI.create("$baseUrl/api/generate"))
            .header("Content-Type", "application/json")
            .timeout(Duration.ofSeconds(30))
            .POST(HttpRequest.BodyPublishers.ofString(body))
            .build()
        try {
            val response = httpClient.send(request, HttpResponse.BodyHandlers.ofString())
            if (response.statusCode() !in 200..299) {
                log.warn("llm_schema_infer status={}", response.statusCode())
                return@withContext null
            }
            val parsed = Json.decodeFromString<OllamaGenerateResponse>(response.body())
            parsed.error?.let {
                log.warn("llm_schema_infer error={}", it)
                return@withContext null
            }
            parsed.response
        } catch (e: Exception) {
            log.warn("llm_schema_infer failed", e)
            null
        }
    }

    private fun buildSchemaInferPrompt(sampleText: String, format: String): String {
        return """
You are a data schema analyst. Given a sample of $format data, infer the column schema and suggest mappings.

Sample data (first rows):
```
$sampleText
```

Respond with ONLY valid JSON in this exact format, no other text:
{"columns":[{"name":"col1","type":"string"},{"name":"col2","type":"number"}],"suggestions":{"textColumn":"description","idColumn":"id","joinKeys":["id"],"semanticFields":["name"]}}

Column types: use "string", "number", "boolean", or "date".
Suggestions:
- textColumn: best column for free text (descriptions, bios, comments)
- idColumn: best column for unique row identifier
- joinKeys: list of columns suitable for entity resolution join keys
- semanticFields: list of columns suitable for semantic matching (names, titles)
""".trimIndent()
    }
}

fun createLlmClient(): LlmClient? {
    val url = Config.settings.llmUrl ?: return null
    val model = Config.settings.llmModel
    return LlmClient(url.trimEnd('/'), model)
}
