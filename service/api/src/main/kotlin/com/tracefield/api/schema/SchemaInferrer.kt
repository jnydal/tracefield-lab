package com.tracefield.api.schema

import com.tracefield.api.llm.createLlmClient
import com.tracefield.api.models.SchemaColumn
import com.tracefield.api.models.SchemaInferResponse
import com.tracefield.api.models.SchemaInferSuggestions
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.slf4j.LoggerFactory
import java.io.StringReader
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeParseException

private val log = LoggerFactory.getLogger("com.tracefield.api.schema.SchemaInferrer")
private val json = Json { ignoreUnknownKeys = true }

private val ID_COLUMN_PATTERNS = listOf("id", "uuid", "uid", "identifier", "pk", "record_id", "source_record_id")
private val TEXT_COLUMN_PATTERNS = listOf("description", "text", "bio", "content", "comment", "notes", "summary", "body")
private val SEMANTIC_PATTERNS = listOf("name", "title", "label", "display_name", "subject")

fun inferSchema(sampleContent: String, format: String): SchemaInferResponse {
    val startMs = System.currentTimeMillis()
    val parsed = parseSample(sampleContent, format)
    if (parsed.headers.isEmpty()) {
        return SchemaInferResponse(columns = emptyList(), suggestions = SchemaInferSuggestions())
    }
    val columns = inferColumnTypes(parsed)
    val heuristicSuggestions = inferHeuristicSuggestions(columns)

    val llmClient = createLlmClient()
    val llmResult = if (llmClient != null) {
        runBlocking { llmClient.invokeSchemaInfer(sampleContent, format) }
    } else null

    val (finalColumns, finalSuggestions) = if (llmResult != null) {
        parseLlmResponse(llmResult)?.let { (cols, sugg) ->
            if (cols.isNotEmpty()) Pair(cols, mergeSuggestions(heuristicSuggestions, sugg))
            else Pair(columns, heuristicSuggestions)
        } ?: Pair(columns, heuristicSuggestions)
    } else {
        Pair(columns, heuristicSuggestions)
    }

    val durationMs = System.currentTimeMillis() - startMs
    log.info(
        "schema_infer format={} columns_count={} llm_used={} duration_ms={}",
        format, finalColumns.size, llmResult != null, durationMs
    )
    return SchemaInferResponse(columns = finalColumns, suggestions = finalSuggestions)
}

private data class ParsedSample(val headers: List<String>, val rows: List<Map<String, String>>)

private fun parseSample(content: String, format: String): ParsedSample {
    return when (format.lowercase()) {
        "json" -> parseJson(content)
        else -> parseCsv(content)
    }
}

private fun parseCsv(content: String): ParsedSample {
    val lines = content.trim().lines().filter { it.isNotBlank() }
    if (lines.isEmpty()) return ParsedSample(emptyList(), emptyList())
    val header = parseCsvLine(lines[0]).map { it.trim().removeSurrounding("\"") }
    val rows = lines.drop(1).take(20).map { line ->
        val values = parseCsvLine(line)
        header.mapIndexed { i, h -> h to values.getOrElse(i) { "" }.trim().removeSurrounding("\"") }.toMap()
    }
    return ParsedSample(header, rows)
}

private fun parseCsvLine(line: String): List<String> {
    val result = mutableListOf<String>()
    var current = StringBuilder()
    var inQuotes = false
    for (c in line) {
        when {
            c == '"' -> inQuotes = !inQuotes
            c == ',' && !inQuotes -> {
                result.add(current.toString())
                current = StringBuilder()
            }
            else -> current.append(c)
        }
    }
    result.add(current.toString())
    return result
}

private fun parseJson(content: String): ParsedSample {
    val trimmed = content.trim()
    if (trimmed.isBlank()) return ParsedSample(emptyList(), emptyList())
    return try {
        val element = json.parseToJsonElement(trimmed)
        val items = when (element) {
            is JsonArray -> element.mapNotNull { rowToMap(it) }
            is JsonObject -> listOfNotNull(rowToMap(element))
            else -> emptyList()
        }
        val rows = items.take(20)
        val headers = rows.flatMap { it.keys }.distinct()
        ParsedSample(headers, rows)
    } catch (e: Exception) {
        log.debug("parseJson failed: {}", e.message)
        ParsedSample(emptyList(), emptyList())
    }
}

private fun rowToMap(element: kotlinx.serialization.json.JsonElement): Map<String, String>? {
    val obj = element as? JsonObject ?: return null
    if (obj.isEmpty()) return null
    return obj.entries.associate { (k, v) ->
        val str = when (v) {
            is JsonPrimitive -> v.content
            else -> v.toString().trim('"')
        }
        k to str
    }
}

private fun inferColumnTypes(parsed: ParsedSample): List<SchemaColumn> {
    return parsed.headers.map { header ->
        val values = parsed.rows.mapNotNull { it[header] }.filter { it.isNotBlank() }.take(100)
        val type = when {
            values.isEmpty() -> "string"
            values.all { isNumeric(it) } -> "number"
            values.all { isBoolean(it) } -> "boolean"
            values.all { isDate(it) } -> "date"
            else -> "string"
        }
        SchemaColumn(name = header, type = type)
    }
}

private fun isNumeric(s: String): Boolean = s.toDoubleOrNull() != null
private fun isBoolean(s: String): Boolean = s.lowercase() in listOf("true", "false", "1", "0", "yes", "no")
private fun isDate(s: String): Boolean {
    if (s.length !in 8..32) return false
    val parsers = listOf(
        DateTimeFormatter.ISO_LOCAL_DATE,
        DateTimeFormatter.ofPattern("yyyy-MM-dd"),
        DateTimeFormatter.ofPattern("MM/dd/yyyy"),
        DateTimeFormatter.ofPattern("dd/MM/yyyy")
    )
    return parsers.any { fmt ->
        try {
            LocalDate.parse(s.take(10), fmt)
            true
        } catch (_: DateTimeParseException) { false }
    }
}

private fun inferHeuristicSuggestions(columns: List<SchemaColumn>): SchemaInferSuggestions {
    val idColumn = columns.find { it.name.lowercase() in ID_COLUMN_PATTERNS }?.name
    val textColumn = columns.find { it.name.lowercase() in TEXT_COLUMN_PATTERNS }?.name
    val joinKeys = idColumn?.let { listOf(it) } ?: columns.firstOrNull()?.name?.let { listOf(it) }
    val semanticFields = columns.filter { it.name.lowercase() in SEMANTIC_PATTERNS }.map { it.name }
        .ifEmpty { textColumn?.let { listOf(it) } ?: emptyList() }
    return SchemaInferSuggestions(
        textColumn = textColumn,
        idColumn = idColumn ?: columns.firstOrNull()?.name,
        joinKeys = joinKeys?.takeIf { it.isNotEmpty() },
        semanticFields = semanticFields.takeIf { it.isNotEmpty() }
    )
}

private fun parseLlmResponse(llmOutput: String): Pair<List<SchemaColumn>, SchemaInferSuggestions>? {
    val jsonStr = extractJsonBlock(llmOutput) ?: llmOutput.trim()
    return try {
        val obj = json.parseToJsonElement(jsonStr).jsonObject
        val cols = obj["columns"]?.jsonArray?.map { c ->
            val co = c.jsonObject
            SchemaColumn(
                name = co["name"]?.jsonPrimitive?.content ?: "",
                type = co["type"]?.jsonPrimitive?.content ?: "string"
            )
        }?.filter { it.name.isNotBlank() } ?: emptyList()
        val suggObj = obj["suggestions"]?.jsonObject
        val sugg = if (suggObj != null) {
            SchemaInferSuggestions(
                textColumn = suggObj["textColumn"]?.jsonPrimitive?.content?.takeIf { it.isNotBlank() },
                idColumn = suggObj["idColumn"]?.jsonPrimitive?.content?.takeIf { it.isNotBlank() },
                joinKeys = suggObj["joinKeys"]?.jsonArray?.mapNotNull { it.jsonPrimitive.content.takeIf { s -> s.isNotBlank() } }?.takeIf { it.isNotEmpty() },
                semanticFields = suggObj["semanticFields"]?.jsonArray?.mapNotNull { it.jsonPrimitive.content.takeIf { s -> s.isNotBlank() } }?.takeIf { it.isNotEmpty() }
            )
        } else SchemaInferSuggestions()
        Pair(cols, sugg)
    } catch (e: Exception) {
        log.debug("parseLlmResponse failed: {}", e.message)
        null
    }
}

private fun extractJsonBlock(text: String): String? {
    val start = text.indexOf('{')
    if (start < 0) return null
    var depth = 0
    for (i in start until text.length) {
        when (text[i]) {
            '{' -> depth++
            '}' -> {
                depth--
                if (depth == 0) return text.substring(start, i + 1)
            }
        }
    }
    return null
}

private fun mergeSuggestions(
    heuristic: SchemaInferSuggestions,
    llm: SchemaInferSuggestions
): SchemaInferSuggestions {
    return SchemaInferSuggestions(
        textColumn = llm.textColumn ?: heuristic.textColumn,
        idColumn = llm.idColumn ?: heuristic.idColumn,
        joinKeys = llm.joinKeys ?: heuristic.joinKeys,
        semanticFields = llm.semanticFields ?: heuristic.semanticFields
    )
}
