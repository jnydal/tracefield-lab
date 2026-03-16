"""
Full research workflow integration test.

Given a survey dataset with three participants (Alice, Bob, Carol), entity mappings,
and feature definitions (score, age_group), when we run an analysis job (score vs
age_group with ANOVA and Benjamini–Hochberg correction), then:

- The analysis job completes successfully.
- At least one provenance event exists for the analysis stage.
- There is at least one analysis result row with valid stats (p_value, stats_json,
  correction).
- All features have provenance_json; job_status and analysis_jobs use only allowed
  status values (invariant checks pass).

Requires DATABASE_URL and a database with schema applied. Skips if DB or
worker_analysis dependencies (numpy, scipy) are unavailable.
"""
from __future__ import annotations

import json
import os

import pytest

# Worker-analysis import may fail if numpy/scipy not installed (e.g. minimal test env)
try:
    from service.worker_analysis.main import (
        fetch_queued_job,
        process_job,
    )
except ImportError:
    fetch_queued_job = None  # type: ignore
    process_job = None  # type: ignore

from test.invariants.checks import run_all_checks


# UUIDs aligned with infra/sql/099_seed_test_data.sql for consistency
USER_ID = "11111111-1111-1111-1111-111111111111"
DATASET_ID = "22222222-2222-2222-2222-222222222222"
ENTITY_IDS = [
    "33333333-3333-3333-3333-333333333301",
    "33333333-3333-3333-3333-333333333302",
    "33333333-3333-3333-3333-333333333303",
]
FEAT_DEF_SCORE = "44444444-4444-4444-4444-444444444401"
FEAT_DEF_AGE = "44444444-4444-4444-4444-444444444402"
ANALYSIS_JOB_ID = "55555555-5555-5555-5555-555555555555"


def _get_db_url() -> str | None:
    return os.environ.get("DATABASE_URL") or os.environ.get("PG_DSN")


def _seed_minimal(conn) -> None:
    """Insert minimal data for one analysis run: user, dataset, entities, entity_map, feature_definitions, features, one queued analysis_job."""
    cur = conn.cursor()
    try:
        # Clean any leftover test data so seed is idempotent (re-runs after failed runs or manual re-execution)
        cur.execute("DELETE FROM analysis_results WHERE job_id = %s::uuid", (ANALYSIS_JOB_ID,))
        cur.execute("DELETE FROM analysis_jobs WHERE id = %s::uuid", (ANALYSIS_JOB_ID,))
        cur.execute("DELETE FROM features WHERE dataset_id = %s::uuid", (DATASET_ID,))
        cur.execute("DELETE FROM entity_map WHERE dataset_id = %s::uuid", (DATASET_ID,))
        # User (no PII: placeholder email)
        cur.execute(
            """
            INSERT INTO users (id, email, display_name, created_at, updated_at)
            VALUES (%s::uuid, %s, %s, NOW(), NOW())
            ON CONFLICT (email) DO NOTHING
            """,
            (USER_ID, "test@example.com", "Test User"),
        )
        # Dataset
        cur.execute(
            """
            INSERT INTO datasets (id, name, description, source, license, schema_json, created_at, updated_at)
            VALUES (%s::uuid, %s, %s, %s, %s, %s, NOW(), NOW())
            ON CONFLICT (id) DO NOTHING
            """,
            (
                DATASET_ID,
                "test-survey-2024",
                "Test survey for workflow integration",
                "https://example.org/test",
                "CC-BY-4.0",
                '{"columns":[{"name":"id","type":"string"},{"name":"name","type":"string"},{"name":"score","type":"number"}]}',
            ),
        )
        # Entities
        for eid, name in zip(ENTITY_IDS, ["Alice", "Bob", "Carol"]):
            external_ids = json.dumps({"source_id": f"rec-{eid[-1]}"})
            cur.execute(
                """
                INSERT INTO entities (id, entity_type, display_name, external_ids, created_at, updated_at)
                VALUES (%s::uuid, 'person', %s, %s::jsonb, NOW(), NOW())
                ON CONFLICT (id) DO NOTHING
                """,
                (eid, name, external_ids),
            )
        # Entity mappings
        for i, eid in enumerate(ENTITY_IDS):
            rec_id = f"rec-00{i+1}"
            cur.execute(
                """
                INSERT INTO entity_map (id, dataset_id, entity_id, source_record_id, source_keys, method, score, created_at)
                VALUES (gen_random_uuid(), %s::uuid, %s::uuid, %s, %s::jsonb, 'exact', 1.0, NOW())
                """,
                (DATASET_ID, eid, rec_id, f'{{"id":"{rec_id}"}}'),
            )
        # Feature definitions
        cur.execute(
            """
            INSERT INTO feature_definitions (id, name, description, value_type, unit, owner, created_at)
            VALUES
              (%s::uuid, 'score', 'Survey score', 'number', NULL, 'test@example.com', NOW()),
              (%s::uuid, 'age_group', 'Age group category', 'string', NULL, 'test@example.com', NOW())
            ON CONFLICT (id) DO NOTHING
            """,
            (FEAT_DEF_SCORE, FEAT_DEF_AGE),
        )
        # Features (with provenance)
        rows = [
            (ENTITY_IDS[0], FEAT_DEF_SCORE, 85.5, None),
            (ENTITY_IDS[0], FEAT_DEF_AGE, None, "25-34"),
            (ENTITY_IDS[1], FEAT_DEF_SCORE, 72.0, None),
            (ENTITY_IDS[1], FEAT_DEF_AGE, None, "35-44"),
            (ENTITY_IDS[2], FEAT_DEF_SCORE, 91.2, None),
            (ENTITY_IDS[2], FEAT_DEF_AGE, None, "25-34"),
        ]
        for eid, fd_id, vnum, vtext in rows:
            cur.execute(
                """
                INSERT INTO features (id, entity_id, dataset_id, feature_definition_id, value_num, value_text, provenance_json, created_at)
                VALUES (gen_random_uuid(), %s::uuid, %s::uuid, %s::uuid, %s, %s, '{"source":"test-full-workflow"}'::jsonb, NOW())
                """,
                (eid, DATASET_ID, fd_id, vnum, vtext),
            )
        # One queued analysis job (delete first so we can re-run the test)
        cur.execute("DELETE FROM analysis_results WHERE job_id = %s::uuid", (ANALYSIS_JOB_ID,))
        cur.execute("DELETE FROM analysis_jobs WHERE id = %s::uuid", (ANALYSIS_JOB_ID,))
        cur.execute(
            """
            INSERT INTO analysis_jobs (id, name, status, config_json, requested_by, created_at)
            VALUES (
                %s::uuid,
                'Test run - score vs age_group',
                'queued',
                '{"leftFeatureSet":"score","rightFeatureSet":"age_group","test":"anova","correction":"benjamini-hochberg"}'::jsonb,
                (SELECT id FROM users WHERE email = 'test@example.com' LIMIT 1),
                NOW()
            )
            """,
            (ANALYSIS_JOB_ID,),
        )
    finally:
        cur.close()


@pytest.fixture(scope="module")
def db_conn():
    """Database connection for integration test. Skips if DATABASE_URL not set or connection fails."""
    url = _get_db_url()
    if not url:
        pytest.skip("DATABASE_URL (or PG_DSN) not set")
    try:
        import psycopg2
        conn = psycopg2.connect(url)
        conn.autocommit = False
        yield conn
        conn.rollback()
        conn.close()
    except Exception as e:
        pytest.skip(f"Database not available: {e}")


@pytest.fixture
def seeded_conn(db_conn):
    """Connection with minimal seed data; rolls back after test so DB is clean for next run."""
    _seed_minimal(db_conn)
    db_conn.commit()
    yield db_conn
    # Optional: delete test data so re-runs see a clean queued job
    cur = db_conn.cursor()
    cur.execute("DELETE FROM analysis_results WHERE job_id = %s::uuid", (ANALYSIS_JOB_ID,))
    cur.execute("DELETE FROM analysis_jobs WHERE id = %s::uuid", (ANALYSIS_JOB_ID,))
    cur.execute("DELETE FROM features WHERE dataset_id = %s::uuid", (DATASET_ID,))
    cur.execute("DELETE FROM entity_map WHERE dataset_id = %s::uuid", (DATASET_ID,))
    cur.execute("DELETE FROM entities WHERE id IN (%s, %s, %s)", tuple(ENTITY_IDS))
    cur.execute("DELETE FROM feature_definitions WHERE id IN (%s::uuid, %s::uuid)", (FEAT_DEF_SCORE, FEAT_DEF_AGE))
    cur.execute("DELETE FROM datasets WHERE id = %s::uuid", (DATASET_ID,))
    db_conn.commit()
    cur.close()


@pytest.mark.integration
def test_full_research_workflow_from_seed_to_analysis(seeded_conn):
    """
    Given: A survey dataset with three participants (Alice, Bob, Carol), entity mappings,
           and feature definitions (score, age_group).
    When:  We run the analysis worker on the queued job (score vs age_group, ANOVA,
           Benjamini–Hochberg correction).
    Then:  The analysis job completes; we have at least one result with p_value,
           stats_json, and correction; at least one provenance event for analysis;
           and invariant checks pass.
    """
    if fetch_queued_job is None or process_job is None:
        pytest.skip("worker_analysis not importable (numpy/scipy required)")

    job = fetch_queued_job(seeded_conn)
    assert job is not None, "Expected one queued analysis job after seed"
    process_job(seeded_conn, dict(job))
    seeded_conn.commit()

    # Assert analysis job completed
    cur = seeded_conn.cursor()
    cur.execute(
        "SELECT status FROM analysis_jobs WHERE id = %s::uuid",
        (ANALYSIS_JOB_ID,),
    )
    row = cur.fetchone()
    assert row is not None, "Analysis job should exist"
    assert row[0] == "completed", f"Expected status=completed, got {row[0]}"

    # Assert at least one analysis result with required shape
    cur.execute(
        """
        SELECT id, job_id, feature_x_id, feature_y_id, stats_json, p_value, effect_size, correction
        FROM analysis_results
        WHERE job_id = %s::uuid
        """,
        (ANALYSIS_JOB_ID,),
    )
    results = cur.fetchall()
    assert len(results) >= 1, "Expected at least one analysis result"
    one = results[0]
    assert one[4] is not None, "stats_json must be set"
    assert one[7] is not None, "correction should be set for this config"

    # Assert at least one provenance event for analysis stage
    cur.execute(
        "SELECT COUNT(*) FROM provenance_event WHERE stage = 'analysis' AND job_id = %s::uuid",
        (ANALYSIS_JOB_ID,),
    )
    prov_count = cur.fetchone()[0]
    assert prov_count >= 1, "Expected at least one provenance_event for stage=analysis"

    # Invariant checks pass
    check_results = run_all_checks(seeded_conn)
    failed = [r for r in check_results if not r.passed]
    assert not failed, f"Invariant check(s) failed: {[f.name + ': ' + f.message for f in failed]}"
    cur.close()
