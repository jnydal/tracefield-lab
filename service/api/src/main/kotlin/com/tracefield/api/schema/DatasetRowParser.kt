package com.tracefield.api.schema

import java.nio.charset.StandardCharsets
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

private val json = Json { ignoreUnknownKeys = true }

/** Column names from the first non-blank line (CSV header). */
fun csvHeaderColumnNamesFromContent(content: String): List<String> {
    val lines = content.trim().lines().filter { it.isNotBlank() }
    if (lines.isEmpty()) return emptyList()
    return parseCsvLinePublic(lines[0]).map { it.trim().removeSurrounding("\"") }.filter { it.isNotBlank() }
}

fun columnNamesFromUploadedBytes(filename: String?, contentType: String?, bytes: ByteArray): List<String> {
    val content = String(bytes, StandardCharsets.UTF_8)
    val asJson = filename?.lowercase()?.endsWith(".json") == true ||
        contentType?.lowercase()?.contains("json") == true
    return if (asJson) {
        val rows = parseFullJson(content)
        rows.firstOrNull()?.keys?.toList() ?: emptyList()
    } else {
        csvHeaderColumnNamesFromContent(content)
    }
}

/**
 * Parse a full CSV string into rows (all rows, no limit).
 * Returns list of maps: column name -> value. First line is header.
 */
fun parseFullCsv(content: String): List<Map<String, String>> {
    val lines = content.trim().lines().filter { it.isNotBlank() }
    if (lines.size < 2) return emptyList()
    val header = parseCsvLinePublic(lines[0]).map { it.trim().removeSurrounding("\"") }
    return lines.drop(1).map { line ->
        val values = parseCsvLinePublic(line)
        header.mapIndexed { i, h -> h to values.getOrElse(i) { "" }.trim().removeSurrounding("\"") }.toMap()
    }
}

/**
 * Parse a full JSON string into rows. Expects root to be an array of objects or a single object.
 * Returns list of maps: key -> string value.
 */
fun parseFullJson(content: String): List<Map<String, String>> {
    val trimmed = content.trim()
    if (trimmed.isBlank()) return emptyList()
    return try {
        val element = json.parseToJsonElement(trimmed)
        when (element) {
            is JsonArray -> element.mapNotNull { jsonRowToMap(it) }
            is JsonObject -> listOfNotNull(jsonRowToMap(element))
            else -> emptyList()
        }
    } catch (e: Exception) {
        emptyList()
    }
}

private fun parseCsvLinePublic(line: String): List<String> {
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

private fun jsonRowToMap(element: kotlinx.serialization.json.JsonElement): Map<String, String>? {
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
