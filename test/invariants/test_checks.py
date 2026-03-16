"""
Pytest for invariant checks. Requires DATABASE_URL and a DB with schema (e.g. after migrations + seed).
Skips if DB is unavailable.
"""
from __future__ import annotations

import os

import pytest

from test.invariants.checks import (
    run_all_checks_from_env,
    CheckResult,
    JOB_STATUS_ALLOWED,
    ANALYSIS_JOBS_STATUS_ALLOWED,
)


def _get_db_url() -> str | None:
    return os.environ.get("DATABASE_URL") or os.environ.get("PG_DSN")


@pytest.fixture(scope="module")
def db_available():
    """Skip if we cannot connect to the database."""
    url = _get_db_url()
    if not url:
        pytest.skip("DATABASE_URL (or PG_DSN) not set")
    try:
        import psycopg2
        conn = psycopg2.connect(url)
        conn.close()
    except Exception:
        pytest.skip("Database not available")
    return url


def test_all_invariants_pass(db_available):
    """All invariant checks should pass when DB is in a valid state (e.g. after seed)."""
    results = run_all_checks_from_env(db_available)
    failed = [r for r in results if not r.passed]
    assert not failed, (
        f"Invariant check(s) failed: {[f.name + ': ' + f.message for f in failed]}"
    )


def test_allowed_status_sets():
    """Allowed status sets are non-empty and match docs."""
    assert len(JOB_STATUS_ALLOWED) == 4
    assert "FINISHED" in JOB_STATUS_ALLOWED and "FAILED" in JOB_STATUS_ALLOWED
    assert len(ANALYSIS_JOBS_STATUS_ALLOWED) == 4
    assert "completed" in ANALYSIS_JOBS_STATUS_ALLOWED and "failed" in ANALYSIS_JOBS_STATUS_ALLOWED
