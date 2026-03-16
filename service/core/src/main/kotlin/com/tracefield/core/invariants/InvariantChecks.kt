package com.tracefield.core.invariants

import com.tracefield.core.DatabaseManager
import java.sql.Connection

/**
 * Result of a single invariant check. Mirrors test/invariants/checks.py.
 * See docs/INVARIANTS.md.
 */
data class InvariantCheckResult(
    val name: String,
    val passed: Boolean,
    val message: String,
    val details: Map<String, Any>? = null,
)

object InvariantChecks {
    private val JOB_STATUS_ALLOWED = setOf("QUEUED", "STARTED", "FINISHED", "FAILED")
    private val ANALYSIS_JOBS_STATUS_ALLOWED = setOf("queued", "running", "completed", "failed")

    /**
     * Run all invariant checks against the database. Uses a single connection for consistency.
     * Each check is run in a try/catch so one failure does not prevent others from running.
     */
    fun runAllChecks(): List<InvariantCheckResult> {
        val conn = DatabaseManager.getConnection()
        return listOf(
            runCheck("feature_provenance") { checkFeatureProvenance(conn) },
            runCheck("job_status_values") { checkJobStatusValues(conn) },
            runCheck("analysis_jobs_status_values") { checkAnalysisJobsStatusValues(conn) },
            runCheck("job_status_terminal_ended_at") { checkJobStatusTerminalEndedAt(conn) },
            runCheck("analysis_results_required_fields") { checkAnalysisResultsRequiredFields(conn) },
        )
    }

    private fun runCheck(
        name: String,
        block: () -> InvariantCheckResult,
    ): InvariantCheckResult {
        return try {
            block()
        } catch (e: Exception) {
            InvariantCheckResult(
                name = name,
                passed = false,
                message = "Check raised: ${e.message}",
                details = mapOf("error" to (e.message ?: e.toString())),
            )
        }
    }

    private fun checkFeatureProvenance(conn: Connection): InvariantCheckResult {
        conn.prepareStatement("SELECT COUNT(*) AS n FROM features WHERE provenance_json IS NULL").use { stmt ->
            stmt.executeQuery().use { rs ->
                val n = if (rs.next()) rs.getLong("n") else 0L
                return if (n > 0) {
                    InvariantCheckResult(
                        name = "feature_provenance",
                        passed = false,
                        message = "$n feature row(s) have null provenance_json",
                        details = mapOf("count" to n),
                    )
                } else {
                    InvariantCheckResult(
                        name = "feature_provenance",
                        passed = true,
                        message = "All feature rows have provenance_json set",
                    )
                }
            }
        }
    }

    private fun checkJobStatusValues(conn: Connection): InvariantCheckResult {
        val placeholders = JOB_STATUS_ALLOWED.joinToString(", ") { "?" }
        val sql = """
            SELECT status, COUNT(*) AS cnt
            FROM job_status
            WHERE status IS NULL OR status NOT IN ($placeholders)
            GROUP BY status
        """.trimIndent()
        conn.prepareStatement(sql).use { stmt ->
            JOB_STATUS_ALLOWED.forEachIndexed { i, s -> stmt.setString(i + 1, s) }
            stmt.executeQuery().use { rs ->
                val bad = mutableMapOf<String, Any>()
                while (rs.next()) {
                    bad[rs.getString("status") ?: "null"] = rs.getLong("cnt")
                }
                return if (bad.isNotEmpty()) {
                    InvariantCheckResult(
                        name = "job_status_values",
                        passed = false,
                        message = "job_status has disallowed status values: $bad",
                        details = bad,
                    )
                } else {
                    InvariantCheckResult(
                        name = "job_status_values",
                        passed = true,
                        message = "All job_status rows have allowed status",
                    )
                }
            }
        }
    }

    private fun checkAnalysisJobsStatusValues(conn: Connection): InvariantCheckResult {
        val placeholders = ANALYSIS_JOBS_STATUS_ALLOWED.joinToString(", ") { "?" }
        val sql = """
            SELECT status, COUNT(*) AS cnt
            FROM analysis_jobs
            WHERE status IS NULL OR status NOT IN ($placeholders)
            GROUP BY status
        """.trimIndent()
        conn.prepareStatement(sql).use { stmt ->
            ANALYSIS_JOBS_STATUS_ALLOWED.forEachIndexed { i, s -> stmt.setString(i + 1, s) }
            stmt.executeQuery().use { rs ->
                val bad = mutableMapOf<String, Any>()
                while (rs.next()) {
                    bad[rs.getString("status") ?: "null"] = rs.getLong("cnt")
                }
                return if (bad.isNotEmpty()) {
                    InvariantCheckResult(
                        name = "analysis_jobs_status_values",
                        passed = false,
                        message = "analysis_jobs has disallowed status values: $bad",
                        details = bad,
                    )
                } else {
                    InvariantCheckResult(
                        name = "analysis_jobs_status_values",
                        passed = true,
                        message = "All analysis_jobs rows have allowed status",
                    )
                }
            }
        }
    }

    private fun checkJobStatusTerminalEndedAt(conn: Connection): InvariantCheckResult {
        conn.prepareStatement("""
            SELECT COUNT(*) AS n
            FROM job_status
            WHERE status IN ('FINISHED', 'FAILED') AND ended_at IS NULL
        """.trimIndent()).use { stmt ->
            stmt.executeQuery().use { rs ->
                val n = if (rs.next()) rs.getLong("n") else 0L
                return if (n > 0) {
                    InvariantCheckResult(
                        name = "job_status_terminal_ended_at",
                        passed = false,
                        message = "$n job_status row(s) in FINISHED/FAILED have null ended_at",
                        details = mapOf("count" to n),
                    )
                } else {
                    InvariantCheckResult(
                        name = "job_status_terminal_ended_at",
                        passed = true,
                        message = "All terminal job_status rows have ended_at set",
                    )
                }
            }
        }
    }

    private fun checkAnalysisResultsRequiredFields(conn: Connection): InvariantCheckResult {
        conn.prepareStatement("""
            SELECT COUNT(*) AS n
            FROM analysis_results
            WHERE job_id IS NULL
               OR feature_x_id IS NULL
               OR feature_y_id IS NULL
               OR stats_json IS NULL
        """.trimIndent()).use { stmt ->
            stmt.executeQuery().use { rs ->
                val n = if (rs.next()) rs.getLong("n") else 0L
                return if (n > 0) {
                    InvariantCheckResult(
                        name = "analysis_results_required_fields",
                        passed = false,
                        message = "$n analysis_results row(s) missing required fields",
                        details = mapOf("count" to n),
                    )
                } else {
                    InvariantCheckResult(
                        name = "analysis_results_required_fields",
                        passed = true,
                        message = "All analysis_results rows have required fields",
                    )
                }
            }
        }
    }
}
