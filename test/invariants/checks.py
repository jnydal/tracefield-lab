"""
Invariant checks for Tracefield pipeline guardrails.

Runnable as script: python -m test.invariants.checks [DATABASE_URL]
Or import and call run_all_checks(conn) / run_all_checks_from_env() from tests.

See docs/INVARIANTS.md for the list of invariants.
"""
from __future__ import annotations

import os
import sys
from dataclasses import dataclass
from typing import Any

# Ensure repo root is on path when run as script
_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    psycopg2 = None  # type: ignore
    RealDictCursor = None  # type: ignore


@dataclass
class CheckResult:
    """Result of a single invariant check."""
    name: str
    passed: bool
    message: str
    details: dict[str, Any] | None = None


# Allowed status values (must match application and optional DB CHECK)
JOB_STATUS_ALLOWED = {"QUEUED", "STARTED", "FINISHED", "FAILED"}
ANALYSIS_JOBS_STATUS_ALLOWED = {"queued", "running", "completed", "failed"}


def check_feature_provenance(conn) -> CheckResult:
    """Every features row must have non-null provenance_json."""
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            "SELECT COUNT(*) AS n FROM features WHERE provenance_json IS NULL"
        )
        row = cur.fetchone()
    n = row["n"] if row else 0
    if n > 0:
        return CheckResult(
            name="feature_provenance",
            passed=False,
            message=f"{n} feature row(s) have null provenance_json",
            details={"count": n},
        )
    return CheckResult(
        name="feature_provenance",
        passed=True,
        message="All feature rows have provenance_json set",
    )


def check_job_status_values(conn) -> CheckResult:
    """job_status.status must be one of QUEUED, STARTED, FINISHED, FAILED."""
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT status, COUNT(*) AS cnt
            FROM job_status
            WHERE status IS NULL OR status NOT IN %s
            GROUP BY status
            """,
            (tuple(JOB_STATUS_ALLOWED),),
        )
        rows = cur.fetchall()
    bad = {r["status"]: r["cnt"] for r in rows}
    if bad:
        return CheckResult(
            name="job_status_values",
            passed=False,
            message=f"job_status has disallowed status values: {bad}",
            details=bad,
        )
    return CheckResult(
        name="job_status_values",
        passed=True,
        message="All job_status rows have allowed status",
    )


def check_analysis_jobs_status_values(conn) -> CheckResult:
    """analysis_jobs.status must be one of queued, running, completed, failed."""
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT status, COUNT(*) AS cnt
            FROM analysis_jobs
            WHERE status IS NULL OR status NOT IN %s
            GROUP BY status
            """,
            (tuple(ANALYSIS_JOBS_STATUS_ALLOWED),),
        )
        rows = cur.fetchall()
    bad = {r["status"]: r["cnt"] for r in rows}
    if bad:
        return CheckResult(
            name="analysis_jobs_status_values",
            passed=False,
            message=f"analysis_jobs has disallowed status values: {bad}",
            details=bad,
        )
    return CheckResult(
        name="analysis_jobs_status_values",
        passed=True,
        message="All analysis_jobs rows have allowed status",
    )


def check_job_status_terminal_has_ended_at(conn) -> CheckResult:
    """job_status rows in FINISHED or FAILED must have ended_at set."""
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT COUNT(*) AS n
            FROM job_status
            WHERE status IN ('FINISHED', 'FAILED') AND ended_at IS NULL
            """
        )
        row = cur.fetchone()
    n = row["n"] if row else 0
    if n > 0:
        return CheckResult(
            name="job_status_terminal_ended_at",
            passed=False,
            message=f"{n} job_status row(s) in FINISHED/FAILED have null ended_at",
            details={"count": n},
        )
    return CheckResult(
        name="job_status_terminal_ended_at",
        passed=True,
        message="All terminal job_status rows have ended_at set",
    )


def check_analysis_results_required_fields(conn) -> CheckResult:
    """Every analysis_results row must have job_id, feature_x_id, feature_y_id, stats_json (non-null)."""
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT COUNT(*) AS n
            FROM analysis_results
            WHERE job_id IS NULL
               OR feature_x_id IS NULL
               OR feature_y_id IS NULL
               OR stats_json IS NULL
            """
        )
        row = cur.fetchone()
    n = row["n"] if row else 0
    if n > 0:
        return CheckResult(
            name="analysis_results_required_fields",
            passed=False,
            message=f"{n} analysis_results row(s) missing required fields",
            details={"count": n},
        )
    return CheckResult(
        name="analysis_results_required_fields",
        passed=True,
        message="All analysis_results rows have required fields",
    )


def check_scalar_extract_provenance_event(conn) -> CheckResult:
    """If any features have provenance_json->>'source' = 'extract-scalar', at least one provenance_event must have stage = 'scalar.extract'."""
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT COUNT(*) AS n
            FROM features
            WHERE provenance_json IS NOT NULL
              AND provenance_json->>'source' = 'extract-scalar'
            """
        )
        row = cur.fetchone()
    n_scalar_features = row["n"] if row else 0
    if n_scalar_features == 0:
        return CheckResult(
            name="scalar_extract_provenance_event",
            passed=True,
            message="No extract-scalar features; check N/A",
        )
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT COUNT(*) AS n
            FROM provenance_event
            WHERE stage = 'scalar.extract'
            """
        )
        row = cur.fetchone()
    n_events = row["n"] if row else 0
    if n_events == 0:
        return CheckResult(
            name="scalar_extract_provenance_event",
            passed=False,
            message=f"{n_scalar_features} feature(s) from extract-scalar but no provenance_event for stage scalar.extract",
            details={"scalar_feature_count": n_scalar_features},
        )
    return CheckResult(
        name="scalar_extract_provenance_event",
        passed=True,
        message="Extract-scalar features have corresponding provenance_event(s)",
    )


def run_all_checks(conn) -> list[CheckResult]:
    """Run all invariant checks against the given DB connection. Returns list of CheckResult."""
    checks = [
        check_feature_provenance,
        check_job_status_values,
        check_analysis_jobs_status_values,
        check_job_status_terminal_has_ended_at,
        check_analysis_results_required_fields,
        check_scalar_extract_provenance_event,
    ]
    results = []
    for check_fn in checks:
        try:
            results.append(check_fn(conn))
        except Exception as e:
            results.append(
                CheckResult(
                    name=check_fn.__name__.replace("check_", ""),
                    passed=False,
                    message=f"Check raised: {e}",
                    details={"error": str(e)},
                )
            )
    return results


def run_all_checks_from_env(database_url: str | None = None) -> list[CheckResult]:
    """Run all checks using DATABASE_URL from env or the given URL. Opens and closes connection."""
    url = database_url or os.environ.get(
        "DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/tracefield"
    )
    if not psycopg2:
        return [
            CheckResult(
                name="deps",
                passed=False,
                message="psycopg2 not installed; cannot run DB checks",
                details={},
            )
        ]
    conn = psycopg2.connect(url)
    try:
        return run_all_checks(conn)
    finally:
        conn.close()


def main() -> int:
    """CLI entrypoint. Exits 0 if all passed, 1 otherwise."""
    url = sys.argv[1] if len(sys.argv) > 1 else None
    results = run_all_checks_from_env(url)
    all_passed = all(r.passed for r in results)
    for r in results:
        status = "PASS" if r.passed else "FAIL"
        print(f"[{status}] {r.name}: {r.message}")
    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
