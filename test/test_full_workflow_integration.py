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

This module also includes the "ice cream / violent crime" integration test: a canonical
spurious-correlation scenario (both variables spike in summer; confound = season) used
to demonstrate cross-dataset correlation and that confound control is a feature request.
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

from test.invariants.checks import check_no_duplicate_features, run_all_checks

try:
    from service.resolver.resolution import run_resolution
except ImportError:
    run_resolution = None  # type: ignore


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

# Ice cream / violent crime scenario: distinct UUIDs to avoid clashes with survey test
DATASET_ID_RETAIL = "66666666-6666-6666-6666-666666666601"
DATASET_ID_CRIME = "66666666-6666-6666-6666-666666666602"
ENTITY_IDS_IC = [f"66666666-6666-6666-6666-6666666667{i:02d}" for i in range(1, 13)]
FEAT_DEF_ICE_CREAM = "66666666-6666-6666-6666-666666666801"
FEAT_DEF_CRIME = "66666666-6666-6666-6666-666666666802"
ANALYSIS_JOB_ID_IC = "66666666-6666-6666-6666-666666666901"

# Heat/Crime demo contract (docs/DEMO_WALKTHROUGH_HEATCRIME.md): same feature names and 12 time_period entities
DATASET_ID_HEATCRIME_CRIME = "77777777-7777-7777-7777-777777777701"
DATASET_ID_HEATCRIME_ICECREAM = "77777777-7777-7777-7777-777777777702"
ENTITY_IDS_HEATCRIME = [f"77777777-7777-7777-7777-7777777777{i:02d}" for i in range(1, 13)]
FEAT_DEF_TOTAL_INCIDENTS = "77777777-7777-7777-7777-777777778801"
FEAT_DEF_UNITS_SOLD = "77777777-7777-7777-7777-777777778802"
ANALYSIS_JOB_ID_HEATCRIME = "77777777-7777-7777-7777-777777779901"


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
        # User (no PII: placeholder email). Use gen_random_uuid() so we never conflict with init seed (e.g. 099_seed_test_data.sql) which may already insert a user with id 11111111...
        cur.execute(
            """
            INSERT INTO users (id, email, display_name, created_at, updated_at)
            VALUES (gen_random_uuid(), %s, %s, NOW(), NOW())
            ON CONFLICT (email) DO NOTHING
            """,
            ("test@example.com", "Test User"),
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


def _seed_ice_cream_crime(conn) -> None:
    """Seed data for ice cream / violent crime spurious-correlation scenario.

    Two datasets (retail-monthly, crime-monthly), 12 entities (months), two numeric
    feature sets that both peak in summer so Spearman correlation is strong. The
    confound is season/temperature; there is no causal link. Used to demonstrate
    cross-dataset correlation and that control variables are a feature request.
    """
    cur = conn.cursor()
    try:
        # Idempotent cleanup
        cur.execute("DELETE FROM analysis_results WHERE job_id = %s::uuid", (ANALYSIS_JOB_ID_IC,))
        cur.execute("DELETE FROM analysis_jobs WHERE id = %s::uuid", (ANALYSIS_JOB_ID_IC,))
        cur.execute("DELETE FROM features WHERE dataset_id IN (%s::uuid, %s::uuid)", (DATASET_ID_RETAIL, DATASET_ID_CRIME))
        cur.execute("DELETE FROM entity_map WHERE dataset_id IN (%s::uuid, %s::uuid)", (DATASET_ID_RETAIL, DATASET_ID_CRIME))
        cur.execute(
            "DELETE FROM entities WHERE id IN (" + ",".join(["%s::uuid"] * len(ENTITY_IDS_IC)) + ")",
            tuple(ENTITY_IDS_IC),
        )
        cur.execute(
            "DELETE FROM feature_definitions WHERE id IN (%s::uuid, %s::uuid)",
            (FEAT_DEF_ICE_CREAM, FEAT_DEF_CRIME),
        )
        cur.execute("DELETE FROM datasets WHERE id IN (%s::uuid, %s::uuid)", (DATASET_ID_RETAIL, DATASET_ID_CRIME))

        # Ensure test user exists. Use gen_random_uuid() so we never conflict with init seed which may already use id 11111111...
        cur.execute(
            """
            INSERT INTO users (id, email, display_name, created_at, updated_at)
            VALUES (gen_random_uuid(), %s, %s, NOW(), NOW())
            ON CONFLICT (email) DO NOTHING
            """,
            ("test@example.com", "Test User"),
        )

        # Two datasets: cross-dataset correlation
        cur.execute(
            """
            INSERT INTO datasets (id, name, description, source, license, schema_json, created_at, updated_at)
            VALUES
              (%s::uuid, 'retail-monthly', 'Monthly retail (ice cream)', 'https://example.org/retail', 'CC-BY-4.0', '{}', NOW(), NOW()),
              (%s::uuid, 'crime-monthly', 'Monthly crime stats', 'https://example.org/crime', 'CC-BY-4.0', '{}', NOW(), NOW())
            ON CONFLICT (id) DO NOTHING
            """,
            (DATASET_ID_RETAIL, DATASET_ID_CRIME),
        )

        # 12 entities (months)
        for i, eid in enumerate(ENTITY_IDS_IC):
            cur.execute(
                """
                INSERT INTO entities (id, entity_type, display_name, external_ids, created_at, updated_at)
                VALUES (%s::uuid, 'month', %s, %s::jsonb, NOW(), NOW())
                ON CONFLICT (id) DO NOTHING
                """,
                (eid, f"month_{i+1:02d}", json.dumps({"month_index": i + 1})),
            )

        # Entity mappings: each dataset maps 12 source records to the same 12 entities
        for i, eid in enumerate(ENTITY_IDS_IC):
            rec = f"month-{i+1:02d}"
            cur.execute(
                """
                INSERT INTO entity_map (id, dataset_id, entity_id, source_record_id, source_keys, method, score, created_at)
                VALUES (gen_random_uuid(), %s::uuid, %s::uuid, %s, %s::jsonb, 'exact', 1.0, NOW())
                """,
                (DATASET_ID_RETAIL, eid, rec, json.dumps({"id": rec})),
            )
            cur.execute(
                """
                INSERT INTO entity_map (id, dataset_id, entity_id, source_record_id, source_keys, method, score, created_at)
                VALUES (gen_random_uuid(), %s::uuid, %s::uuid, %s, %s::jsonb, 'exact', 1.0, NOW())
                """,
                (DATASET_ID_CRIME, eid, rec, json.dumps({"id": rec})),
            )

        # Feature definitions
        cur.execute(
            """
            INSERT INTO feature_definitions (id, name, description, value_type, unit, owner, created_at)
            VALUES
              (%s::uuid, 'ice_cream_sales', 'Ice cream sales (seasonal)', 'number', NULL, 'test@example.com', NOW()),
              (%s::uuid, 'violent_crime_count', 'Violent crime count (seasonal)', 'number', NULL, 'test@example.com', NOW())
            ON CONFLICT (id) DO NOTHING
            """,
            (FEAT_DEF_ICE_CREAM, FEAT_DEF_CRIME),
        )

        # Seasonal pattern: both high in summer (indices 4-8), low otherwise -> strong correlation
        # Spurious correlation by design; controlling for temperature/season would remove it (future feature).
        ice_cream_values = [10, 10, 12, 14, 18, 18, 18, 14, 12, 10, 10, 10]
        crime_values = [1, 1, 2, 3, 5, 5, 5, 3, 2, 1, 1, 1]
        for i, eid in enumerate(ENTITY_IDS_IC):
            cur.execute(
                """
                INSERT INTO features (id, entity_id, dataset_id, feature_definition_id, value_num, value_text, provenance_json, created_at)
                VALUES (gen_random_uuid(), %s::uuid, %s::uuid, %s::uuid, %s, NULL, '{"source":"test-ice-cream-crime"}'::jsonb, NOW())
                """,
                (eid, DATASET_ID_RETAIL, FEAT_DEF_ICE_CREAM, ice_cream_values[i]),
            )
            cur.execute(
                """
                INSERT INTO features (id, entity_id, dataset_id, feature_definition_id, value_num, value_text, provenance_json, created_at)
                VALUES (gen_random_uuid(), %s::uuid, %s::uuid, %s::uuid, %s, NULL, '{"source":"test-ice-cream-crime"}'::jsonb, NOW())
                """,
                (eid, DATASET_ID_CRIME, FEAT_DEF_CRIME, crime_values[i]),
            )

        # Queued analysis job: Spearman(ice_cream_sales, violent_crime_count)
        cur.execute(
            """
            INSERT INTO analysis_jobs (id, name, status, config_json, requested_by, created_at)
            VALUES (
                %s::uuid,
                'Ice cream vs violent crime (spurious)',
                'queued',
                '{"leftFeatureSet":"ice_cream_sales","rightFeatureSet":"violent_crime_count","test":"spearman","correction":"benjamini-hochberg"}'::jsonb,
                (SELECT id FROM users WHERE email = 'test@example.com' LIMIT 1),
                NOW()
            )
            """,
            (ANALYSIS_JOB_ID_IC,),
        )
    finally:
        cur.close()


def _seed_heatcrime_demo_contract(conn) -> None:
    """Seed data matching docs/DEMO_WALKTHROUGH_HEATCRIME.md: 12 time_period entities, two datasets,
    feature definitions total_incidents and units_sold_thousands, and features that produce the
    documented spurious correlation. Locks the demo contract for integration tests.
    """
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM analysis_results WHERE job_id = %s::uuid", (ANALYSIS_JOB_ID_HEATCRIME,))
        cur.execute("DELETE FROM analysis_jobs WHERE id = %s::uuid", (ANALYSIS_JOB_ID_HEATCRIME,))
        cur.execute(
            "DELETE FROM features WHERE dataset_id IN (%s::uuid, %s::uuid)",
            (DATASET_ID_HEATCRIME_CRIME, DATASET_ID_HEATCRIME_ICECREAM),
        )
        cur.execute(
            "DELETE FROM entity_map WHERE dataset_id IN (%s::uuid, %s::uuid)",
            (DATASET_ID_HEATCRIME_CRIME, DATASET_ID_HEATCRIME_ICECREAM),
        )
        cur.execute(
            "DELETE FROM entities WHERE id IN (" + ",".join(["%s::uuid"] * len(ENTITY_IDS_HEATCRIME)) + ")",
            tuple(ENTITY_IDS_HEATCRIME),
        )
        cur.execute(
            "DELETE FROM feature_definitions WHERE id IN (%s::uuid, %s::uuid)",
            (FEAT_DEF_TOTAL_INCIDENTS, FEAT_DEF_UNITS_SOLD),
        )
        cur.execute(
            "DELETE FROM datasets WHERE id IN (%s::uuid, %s::uuid)",
            (DATASET_ID_HEATCRIME_CRIME, DATASET_ID_HEATCRIME_ICECREAM),
        )

        cur.execute(
            """
            INSERT INTO users (id, email, display_name, created_at, updated_at)
            VALUES (gen_random_uuid(), %s, %s, NOW(), NOW())
            ON CONFLICT (email) DO NOTHING
            """,
            ("test@example.com", "Test User"),
        )

        cur.execute(
            """
            INSERT INTO datasets (id, name, description, source, license, schema_json, created_at, updated_at)
            VALUES
              (%s::uuid, 'NYC Crime Statistics 2023', 'Crime demo dataset', 'https://example.org', 'CC-BY-4.0', '{}', NOW(), NOW()),
              (%s::uuid, 'NYC Ice Cream Sales 2023', 'Ice cream demo dataset', 'https://example.org', 'CC-BY-4.0', '{}', NOW(), NOW())
            ON CONFLICT (id) DO NOTHING
            """,
            (DATASET_ID_HEATCRIME_CRIME, DATASET_ID_HEATCRIME_ICECREAM),
        )

        for i, eid in enumerate(ENTITY_IDS_HEATCRIME):
            cur.execute(
                """
                INSERT INTO entities (id, entity_type, display_name, external_ids, created_at, updated_at)
                VALUES (%s::uuid, 'time_period', %s, %s::jsonb, NOW(), NOW())
                ON CONFLICT (id) DO NOTHING
                """,
                (eid, f"2023-{i+1:02d}", json.dumps({"month_index": i + 1})),
            )

        for i, eid in enumerate(ENTITY_IDS_HEATCRIME):
            rec_crime = f"NYC-CRIME-2023-{i+1:02d}"
            cur.execute(
                """
                INSERT INTO entity_map (id, dataset_id, entity_id, source_record_id, source_keys, method, score, created_at)
                VALUES (gen_random_uuid(), %s::uuid, %s::uuid, %s, %s::jsonb, 'exact', 1.0, NOW())
                """,
                (DATASET_ID_HEATCRIME_CRIME, eid, rec_crime, json.dumps({"crime_record_id": rec_crime})),
            )
            rec_ice = f"ICECREAM-{['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][i]}-2023"
            cur.execute(
                """
                INSERT INTO entity_map (id, dataset_id, entity_id, source_record_id, source_keys, method, score, created_at)
                VALUES (gen_random_uuid(), %s::uuid, %s::uuid, %s, %s::jsonb, 'exact', 1.0, NOW())
                """,
                (DATASET_ID_HEATCRIME_ICECREAM, eid, rec_ice, json.dumps({"period_id": rec_ice})),
            )

        cur.execute(
            """
            INSERT INTO feature_definitions (id, name, description, value_type, unit, owner, created_at)
            VALUES
              (%s::uuid, 'total_incidents', 'Total crime incidents (demo)', 'number', NULL, 'test@example.com', NOW()),
              (%s::uuid, 'units_sold_thousands', 'Units sold thousands (demo)', 'number', NULL, 'test@example.com', NOW())
            ON CONFLICT (id) DO NOTHING
            """,
            (FEAT_DEF_TOTAL_INCIDENTS, FEAT_DEF_UNITS_SOLD),
        )

        # Seasonal pattern from demo: crime and ice cream both high in summer (indices 5-7), low in winter -> strong correlation
        crime_values = [5821, 5900, 6100, 6912, 7200, 8000, 10412, 9000, 7612, 7000, 6000, 5908]
        ice_cream_values = [11.8, 12.0, 15.0, 38.4, 45.0, 80.0, 148.2, 100.0, 51.6, 40.0, 20.0, 15.9]
        prov = json.dumps({"source": "test-heatcrime-demo"})
        for i, eid in enumerate(ENTITY_IDS_HEATCRIME):
            cur.execute(
                """
                INSERT INTO features (id, entity_id, dataset_id, feature_definition_id, value_num, value_text, provenance_json, created_at)
                VALUES (gen_random_uuid(), %s::uuid, %s::uuid, %s::uuid, %s, NULL, %s::jsonb, NOW())
                """,
                (eid, DATASET_ID_HEATCRIME_CRIME, FEAT_DEF_TOTAL_INCIDENTS, crime_values[i], prov),
            )
            cur.execute(
                """
                INSERT INTO features (id, entity_id, dataset_id, feature_definition_id, value_num, value_text, provenance_json, created_at)
                VALUES (gen_random_uuid(), %s::uuid, %s::uuid, %s::uuid, %s, NULL, %s::jsonb, NOW())
                """,
                (eid, DATASET_ID_HEATCRIME_ICECREAM, FEAT_DEF_UNITS_SOLD, ice_cream_values[i], prov),
            )

        cur.execute(
            """
            INSERT INTO analysis_jobs (id, name, status, config_json, requested_by, created_at)
            VALUES (
                %s::uuid,
                'Crime vs ice cream — Phase 1 (spurious)',
                'queued',
                '{"leftFeatureSet":"total_incidents","rightFeatureSet":"units_sold_thousands","test":"spearman","correction":"benjamini-hochberg"}'::jsonb,
                (SELECT id FROM users WHERE email = 'test@example.com' LIMIT 1),
                NOW()
            )
            """,
            (ANALYSIS_JOB_ID_HEATCRIME,),
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


@pytest.fixture
def seeded_ice_cream_conn(db_conn):
    """Connection with ice cream / violent crime seed data; cleans up after test."""
    _seed_ice_cream_crime(db_conn)
    db_conn.commit()
    yield db_conn
    cur = db_conn.cursor()
    cur.execute("DELETE FROM analysis_results WHERE job_id = %s::uuid", (ANALYSIS_JOB_ID_IC,))
    cur.execute("DELETE FROM analysis_jobs WHERE id = %s::uuid", (ANALYSIS_JOB_ID_IC,))
    cur.execute("DELETE FROM features WHERE dataset_id IN (%s::uuid, %s::uuid)", (DATASET_ID_RETAIL, DATASET_ID_CRIME))
    cur.execute("DELETE FROM entity_map WHERE dataset_id IN (%s::uuid, %s::uuid)", (DATASET_ID_RETAIL, DATASET_ID_CRIME))
    cur.execute(
        "DELETE FROM entities WHERE id IN (" + ",".join(["%s::uuid"] * len(ENTITY_IDS_IC)) + ")",
        tuple(ENTITY_IDS_IC),
    )
    cur.execute(
        "DELETE FROM feature_definitions WHERE id IN (%s::uuid, %s::uuid)",
        (FEAT_DEF_ICE_CREAM, FEAT_DEF_CRIME),
    )
    cur.execute("DELETE FROM datasets WHERE id IN (%s::uuid, %s::uuid)", (DATASET_ID_RETAIL, DATASET_ID_CRIME))
    db_conn.commit()
    cur.close()


@pytest.fixture
def seeded_heatcrime_conn(db_conn):
    """Connection with Heat/Crime demo contract seed (12 time_periods, total_incidents, units_sold_thousands); cleans up after test."""
    _seed_heatcrime_demo_contract(db_conn)
    db_conn.commit()
    yield db_conn
    cur = db_conn.cursor()
    cur.execute("DELETE FROM analysis_results WHERE job_id = %s::uuid", (ANALYSIS_JOB_ID_HEATCRIME,))
    cur.execute("DELETE FROM analysis_jobs WHERE id = %s::uuid", (ANALYSIS_JOB_ID_HEATCRIME,))
    cur.execute(
        "DELETE FROM features WHERE dataset_id IN (%s::uuid, %s::uuid)",
        (DATASET_ID_HEATCRIME_CRIME, DATASET_ID_HEATCRIME_ICECREAM),
    )
    cur.execute(
        "DELETE FROM entity_map WHERE dataset_id IN (%s::uuid, %s::uuid)",
        (DATASET_ID_HEATCRIME_CRIME, DATASET_ID_HEATCRIME_ICECREAM),
    )
    cur.execute(
        "DELETE FROM entities WHERE id IN (" + ",".join(["%s::uuid"] * len(ENTITY_IDS_HEATCRIME)) + ")",
        tuple(ENTITY_IDS_HEATCRIME),
    )
    cur.execute(
        "DELETE FROM feature_definitions WHERE id IN (%s::uuid, %s::uuid)",
        (FEAT_DEF_TOTAL_INCIDENTS, FEAT_DEF_UNITS_SOLD),
    )
    cur.execute(
        "DELETE FROM datasets WHERE id IN (%s::uuid, %s::uuid)",
        (DATASET_ID_HEATCRIME_CRIME, DATASET_ID_HEATCRIME_ICECREAM),
    )
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
    stats_json = one[4]
    assert stats_json is not None, "stats_json must be set"
    if isinstance(stats_json, str):
        stats_json = json.loads(stats_json)
    assert stats_json.get("test") == "anova", "Expected ANOVA result"
    assert "f_statistic" in stats_json and "p_value" in stats_json, "stats_json should have f_statistic and p_value"
    assert one[5] is not None or stats_json.get("p_value") is not None, "p_value should be set in result or stats_json"
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


@pytest.mark.integration
def test_ice_cream_crime_spurious_correlation_cross_dataset(seeded_ice_cream_conn):
    """
    Ice cream / violent crime: canonical spurious-correlation scenario.

    Both variables spike in summer and drop in winter; the confound is
    temperature/season (people outside more, more interaction, more ice cream and
    more reported crime). There is no causal link between ice cream and crime.

    This test demonstrates why that example is a weak argument against Tracefield:
    (1) Cross-dataset: the two feature sets come from two different datasets
        (retail-monthly, crime-monthly) joined by shared entities — the kind of
        correlation Tracefield is built for. (2) Confound as feature request: we
        assert the job completes and produces a strong correlation; the
        architecture supports adding control variables, detrending, and
        stratification later. (3) Embedding layer: semantic similarity via BGE is
        a separate path; this test focuses on numeric feature-vs-feature correlation.
    """
    if fetch_queued_job is None or process_job is None:
        pytest.skip("worker_analysis not importable (numpy/scipy required)")

    conn = seeded_ice_cream_conn
    job = fetch_queued_job(conn)
    assert job is not None, "Expected one queued analysis job after seed"
    process_job(conn, dict(job))
    conn.commit()

    cur = conn.cursor()
    cur.execute(
        "SELECT status FROM analysis_jobs WHERE id = %s::uuid",
        (ANALYSIS_JOB_ID_IC,),
    )
    row = cur.fetchone()
    assert row is not None, "Analysis job should exist"
    assert row[0] == "completed", f"Expected status=completed, got {row[0]}"

    cur.execute(
        """
        SELECT id, job_id, feature_x_id, feature_y_id, stats_json, p_value, effect_size, correction
        FROM analysis_results
        WHERE job_id = %s::uuid
        """,
        (ANALYSIS_JOB_ID_IC,),
    )
    results = cur.fetchall()
    assert len(results) >= 1, "Expected at least one analysis result"
    one = results[0]
    stats_json = one[4]
    p_value = one[5]
    effect_size = one[6]
    assert stats_json is not None, "stats_json must be set"
    if isinstance(stats_json, str):
        stats_json = json.loads(stats_json)
    assert stats_json.get("test") == "spearman", "Expected Spearman result"
    assert stats_json.get("n") == 12, "Expected n=12 (12 months)"
    # Worker stores Spearman r in "correlation"; effect_size column is also set from it.
    rho = stats_json.get("correlation") or stats_json.get("rho") or effect_size
    assert rho is not None, "Spearman result should include correlation/rho or effect_size"
    # Spurious correlation by design; controlling for temperature/season would remove it (future feature).
    if isinstance(rho, (int, float)) and rho == rho:  # exclude NaN
        assert rho > 0.7, f"Expected strong positive correlation (rho > 0.7), got {rho}"
    assert p_value is not None, "p_value should be set"
    assert p_value < 0.05, f"Expected significant p-value for built-in correlation, got {p_value}"

    cur.execute(
        "SELECT COUNT(*) FROM provenance_event WHERE stage = 'analysis' AND job_id = %s::uuid",
        (ANALYSIS_JOB_ID_IC,),
    )
    prov_count = cur.fetchone()[0]
    assert prov_count >= 1, "Expected at least one provenance_event for stage=analysis"

    check_results = run_all_checks(conn)
    failed = [r for r in check_results if not r.passed]
    assert not failed, f"Invariant check(s) failed: {[f.name + ': ' + f.message for f in failed]}"
    cur.close()


@pytest.mark.integration
def test_heatcrime_demo_contract(seeded_heatcrime_conn):
    """
    Heat/Crime demo contract (docs/DEMO_WALKTHROUGH_HEATCRIME.md).

    Seeds 12 time_period entities, two datasets (crime + ice cream), feature definitions
    total_incidents and units_sold_thousands, and features that produce the documented
    spurious correlation. Runs Spearman(total_incidents, units_sold_thousands) and asserts:
    - Job completes successfully.
    - Result has strong positive correlation (r > 0.9) and significant p-value.
    - Provenance and invariant checks pass.

    This locks the demo contract: if the walkthrough or feature names change, update
    this test and the doc together.
    """
    if fetch_queued_job is None or process_job is None:
        pytest.skip("worker_analysis not importable (numpy/scipy required)")

    conn = seeded_heatcrime_conn
    job = fetch_queued_job(conn)
    assert job is not None, "Expected one queued analysis job after Heat/Crime demo seed"
    process_job(conn, dict(job))
    conn.commit()

    cur = conn.cursor()
    cur.execute(
        "SELECT status FROM analysis_jobs WHERE id = %s::uuid",
        (ANALYSIS_JOB_ID_HEATCRIME,),
    )
    row = cur.fetchone()
    assert row is not None, "Analysis job should exist"
    assert row[0] == "completed", f"Expected status=completed, got {row[0]}"

    cur.execute(
        """
        SELECT id, job_id, feature_x_id, feature_y_id, stats_json, p_value, effect_size, correction
        FROM analysis_results
        WHERE job_id = %s::uuid
        """,
        (ANALYSIS_JOB_ID_HEATCRIME,),
    )
    results = cur.fetchall()
    assert len(results) >= 1, "Expected at least one analysis result"
    one = results[0]
    stats_json = one[4]
    assert stats_json is not None, "stats_json must be set"
    if isinstance(stats_json, str):
        stats_json = json.loads(stats_json)
    assert stats_json.get("test") == "spearman", "Expected Spearman result"
    assert stats_json.get("n") == 12, "Expected n=12 (12 months)"
    rho = stats_json.get("correlation") or stats_json.get("rho") or one[6]
    assert rho is not None, "Spearman result should include correlation/rho or effect_size"
    if isinstance(rho, (int, float)) and rho == rho:
        assert rho > 0.9, f"Demo expects strong correlation (rho > 0.9), got {rho}"
    assert one[5] is not None, "p_value should be set"
    assert one[5] < 0.05, f"Expected significant p-value for demo data, got {one[5]}"

    cur.execute(
        "SELECT COUNT(*) FROM provenance_event WHERE stage = 'analysis' AND job_id = %s::uuid",
        (ANALYSIS_JOB_ID_HEATCRIME,),
    )
    assert cur.fetchone()[0] >= 1, "Expected at least one provenance_event for stage=analysis"

    check_results = run_all_checks(conn)
    failed = [r for r in check_results if not r.passed]
    assert not failed, f"Invariant check(s) failed: {[f.name + ': ' + f.message for f in failed]}"
    cur.close()


# ---------------------------------------------------------------------------
# Tests for data-quality guardrails (EMBEDDING_MAPPING_BUG.txt issues 1, 3, 4)
# ---------------------------------------------------------------------------


@pytest.mark.integration
def test_no_duplicate_features_invariant(seeded_heatcrime_conn):
    """check_no_duplicate_features passes on clean data and fails after a duplicate is injected.

    Uses dataset_id=NULL to bypass the unique partial index (which only covers non-NULL
    dataset_id), verifying that the invariant check covers both cases.
    """
    conn = seeded_heatcrime_conn
    cur = conn.cursor()

    # Clean state must pass.
    result = check_no_duplicate_features(conn)
    assert result.passed, f"Expected PASS on clean seeded data, got: {result.message}"

    # Inject a duplicate row for one entity with dataset_id=NULL.
    cur.execute(
        """
        SELECT entity_id, feature_definition_id, value_num, provenance_json
        FROM features
        WHERE feature_definition_id = %s::uuid
        LIMIT 1
        """,
        (FEAT_DEF_TOTAL_INCIDENTS,),
    )
    orig = cur.fetchone()
    assert orig is not None, "Expected at least one total_incidents feature row"
    cur.execute(
        """
        INSERT INTO features (id, entity_id, feature_definition_id, dataset_id, value_num, provenance_json, created_at)
        VALUES (gen_random_uuid(), %s::uuid, %s::uuid, NULL, %s, %s::jsonb, NOW())
        """,
        (orig[0], orig[1], orig[2], orig[3]),
    )
    conn.commit()

    # After injection the invariant must fail.
    result = check_no_duplicate_features(conn)
    assert not result.passed, "Expected FAIL after injecting duplicate feature row"
    assert "duplicate" in result.message.lower()

    # Cleanup injected row (fixture teardown only removes rows by dataset_id).
    cur.execute(
        "DELETE FROM features WHERE dataset_id IS NULL AND entity_id = %s::uuid AND feature_definition_id = %s::uuid",
        (orig[0], orig[1]),
    )
    conn.commit()
    cur.close()


@pytest.mark.integration
def test_analysis_deduplicates_null_dataset_feature_rows(seeded_heatcrime_conn, caplog):
    """Analysis worker deduplicates duplicate feature rows (dataset_id=NULL) and emits a WARNING.

    Verifies: n=12 in stats_json after dedup, and the dedup warning appears in logs.
    """
    if fetch_queued_job is None or process_job is None:
        pytest.skip("worker_analysis not importable (numpy/scipy required)")

    import logging

    conn = seeded_heatcrime_conn
    cur = conn.cursor()

    # Inject a duplicate total_incidents row for one entity with dataset_id=NULL.
    cur.execute(
        """
        SELECT entity_id, feature_definition_id, value_num, provenance_json
        FROM features
        WHERE feature_definition_id = %s::uuid
        LIMIT 1
        """,
        (FEAT_DEF_TOTAL_INCIDENTS,),
    )
    orig = cur.fetchone()
    assert orig is not None
    cur.execute(
        """
        INSERT INTO features (id, entity_id, feature_definition_id, dataset_id, value_num, provenance_json, created_at)
        VALUES (gen_random_uuid(), %s::uuid, %s::uuid, NULL, %s, %s::jsonb, NOW())
        """,
        (orig[0], orig[1], orig[2], orig[3]),
    )
    conn.commit()

    with caplog.at_level(logging.WARNING, logger="worker-analysis"):
        job = fetch_queued_job(conn)
        assert job is not None, "Expected a queued analysis job"
        process_job(conn, dict(job))
        conn.commit()

    cur.execute(
        "SELECT status FROM analysis_jobs WHERE id = %s::uuid",
        (ANALYSIS_JOB_ID_HEATCRIME,),
    )
    assert cur.fetchone()[0] == "completed", "Job should complete despite duplicate rows"

    cur.execute(
        "SELECT stats_json FROM analysis_results WHERE job_id = %s::uuid",
        (ANALYSIS_JOB_ID_HEATCRIME,),
    )
    stats = json.loads(cur.fetchone()[0])
    assert stats.get("n") == 12, f"Expected n=12 after dedup, got {stats.get('n')}"

    assert any(
        "deduplicated" in r.message for r in caplog.records
    ), "Expected dedup warning in worker-analysis logs"

    # Cleanup injected row.
    cur.execute(
        "DELETE FROM features WHERE dataset_id IS NULL AND entity_id = %s::uuid AND feature_definition_id = %s::uuid",
        (orig[0], orig[1]),
    )
    conn.commit()
    cur.close()


@pytest.mark.integration
def test_resolution_warns_on_empty_join_keys(db_conn, caplog):
    """run_resolution emits a WARNING when joinKeys is empty (signals semantic-only fallback)."""
    if run_resolution is None:
        pytest.skip("service.resolver.resolution not importable")

    import logging
    import uuid

    fake_job = {
        "id": str(uuid.uuid4()),
        "dataset_id": str(uuid.uuid4()),
        "entity_type": "time_period",
        "config_json": {
            "records": [{"source_record_id": "r1", "keys": {"canonical_month": "2023-01"}}],
            "joinKeys": [],
            "semanticFields": ["canonical_month"],
            "threshold": 0.85,
            "createIfNoMatch": False,
        },
    }

    with caplog.at_level(logging.WARNING, logger="resolver.resolution"):
        run_resolution(db_conn, fake_job)

    assert any(
        "joinKeys is empty" in r.message for r in caplog.records
    ), "Expected warning about empty joinKeys in resolver.resolution logs"
