# Tracefield Lab — System Invariants

This document lists **invariants** that protect the pipeline from silent derailing. They are core assumptions that must hold for reproducibility, data integrity, and correct behaviour. New pipeline stages and schema changes must preserve these invariants.

## Summary Table

| Invariant | Meaning | Enforced by |
|-----------|--------|-------------|
| [Provenance on output](#1-provenance-on-output) | Every pipeline stage that produces or transforms data emits at least one `provenance_event`. | Workers (code); verified by [invariant checks](test/invariants/checks.py) in CI. |
| [Scalar-extract provenance](#scalar-extract-provenance) | If any features have `provenance_json->>'source' = 'extract-scalar'`, at least one `provenance_event` has `stage = 'scalar.extract'`. | API (emits event on success); invariant check `scalar_extract_provenance_event`. |
| [Job status lifecycle](#2-job-status-lifecycle) | `job_status` and `analysis_jobs` use only allowed status values and sensible transitions. | Application logic; DB CHECK constraints (optional migration). |
| [Feature contract](#3-feature-contract) | Every row in `features` has `entity_id`, `feature_definition_id`, and non-null `provenance_json`. | DB FKs; application validation; invariant checks. |
| [Analysis result shape](#4-analysis-result-shape) | Every row in `analysis_results` has required fields; multi-test jobs have correction. | Worker-analysis; invariant checks. |
| [No orphan features](#5-no-orphan-features) | `features` reference existing `entities` and `feature_definitions`. | DB foreign keys. |
| [Stuck job detection](#6-stuck-job-detection) | Jobs stuck in running/STARTED can be detected for observability. | View `pipeline_stuck`; not a hard invariant. |

---

## 1. Provenance on output

**Invariant:** Every pipeline stage that produces or transforms data emits at least one row in `provenance_event` with sufficient context (e.g. `job_id` or `dataset_id`, `stage`, `detail`).

**Minimum provenance context:** Provenance must capture at least: `module`, `version`, `config_hash`, `source_dataset_id`, `job_id`, `timestamp`. Analysis jobs must store the full config, code version, and all input identifiers so results are reproducible from provenance alone.

**Rationale:** Reproducibility and audit trail depend on a complete record of how data was produced. Silent omission of provenance makes results unreproducible.

**Enforcement:**

- **Application:** Worker-embeddings, resolver, worker-analysis, and the API (scalar extract) emit provenance after writing data. See `.cursor/rules/tracefield.mdc` (Provenance — Non-Negotiable).
- **Tests:** Full-workflow integration test asserts presence of provenance for embeddings and analysis. Invariant check module can query for stages that should have produced data and verify at least one event exists.

### Scalar-extract provenance

**Invariant:** If any row in `features` has `provenance_json->>'source' = 'extract-scalar'`, then at least one row in `provenance_event` must have `stage = 'scalar.extract'`.

**Rationale:** The scalar-extract pipeline stage (API `POST /datasets/{id}/extract-scalar`) produces feature rows; the same provenance-on-output rule applies so the audit trail is complete.

**Enforcement:**

- **Application:** After a successful scalar extract, the API calls `logProvenanceEvent(jobId, datasetId, stage = "scalar.extract", detail = result)`.
- **Tests:** Invariant check `scalar_extract_provenance_event` fails if there are extract-scalar features but no `provenance_event` for stage `scalar.extract`. When there are no such features, the check passes (N/A).

---

## 2. Job status lifecycle

**Invariant:**

- **job_status:** Only statuses `QUEUED`, `STARTED`, `FINISHED`, `FAILED`. Terminal states (`FINISHED`, `FAILED`) have `ended_at` set.
- **analysis_jobs:** Only statuses `queued`, `running`, `completed`, `failed`. Terminal states have `ended_at` set.

**Rationale:** Invalid or unknown statuses cause UI and operators to misdiagnose pipeline state. Enforcing allowed values prevents accidental corruption.

**Enforcement:**

- **Application:** API and workers only write these statuses.
- **Database (optional):** Migration adds CHECK constraints on `job_status.status` and `analysis_jobs.status` so invalid values cannot be written.
- **Tests:** Invariant checks verify no row has a status outside the allowed set.

---

## 3. Feature contract

**Invariant:** Every row in `features` has:

- `entity_id` (NOT NULL, FK to `entities`)
- `feature_definition_id` (NOT NULL, FK to `feature_definitions`)
- `provenance_json` (NOT NULL or effectively always set by application)

**Rationale:** Features without provenance break reproducibility; missing entity or definition breaks referential integrity and queries.

**Enforcement:**

- **Database:** `entity_id` and `feature_definition_id` are NOT NULL and have FKs. `provenance_json` can be nullable in schema; application and invariant checks ensure it is set.
- **Tests:** Invariant check fails if any feature row has null `provenance_json`.

---

## 4. Analysis result shape

**Invariant:** Every row in `analysis_results` has:

- `job_id` (FK to `analysis_jobs`)
- `feature_x_id`, `feature_y_id` (FK to `feature_definitions`)
- `stats_json` (NOT NULL)

When an analysis produces multiple p-values, config or results include a correction method. Effect sizes or confidence intervals accompany p-values where applicable.

**Rationale:** Ensures analysis output is complete and scientifically valid (see NFR.md — Statistical rigor).

**Enforcement:**

- **Application:** Worker-analysis only inserts rows with these fields set; config stores correction.
- **Tests:** Full-workflow test asserts at least one result with `p_value`, `stats_json`, and correction when applicable. Invariant checks can verify no result row has null required fields.

---

## 5. No orphan features

**Invariant:** Every `features.entity_id` references an existing `entities.id`; every `features.feature_definition_id` references an existing `feature_definitions.id`.

**Rationale:** Orphan rows break joins and reporting.

**Enforcement:** Database foreign key constraints. No application-level check needed beyond normal inserts/updates.

---

## 6. Stuck job detection

**Invariant (soft):** Jobs that remain in `STARTED` (job_status) or `running` (analysis_jobs) for an extended period with no progress can be flagged for operational attention.

**Rationale:** Not a data-integrity invariant but an observability aid; helps detect silent worker failures.

**Enforcement:** View `pipeline_stuck` (in `infra/sql/011_observability.sql`) and dashboards. No test or CHECK enforces this.

---

## Live checks (production)

The API exposes **`GET /invariants`** so production (or staging) can detect invariant violations live. On each request the API runs the same six checks against the database.

- **When all checks pass:** Response is **200 OK** with a JSON body containing `allPass: true` and a list of check results (`name`, `passed`, `message`, optional `details`).
- **When any check fails:** Response is **503 Service Unavailable** with the same JSON body and `allPass: false`; the `checks` array lists which checks failed and their messages.

Monitoring (e.g. Prometheus HTTP probe, Grafana, or uptime check) should poll `GET /invariants` and **alert on non-200** (or on `allPass == false` in the body). This gives live detection of pipeline drift without adding assertions inside workers. See [RUNBOOK.md](../RUNBOOK.md) for how to call and interpret the endpoint.

---

## Running invariant checks

- **In CI:** Invariant checks run as part of the test suite (e.g. `pytest test/invariants/` or invoked from the full-workflow integration test).
- **Locally:** From repo root, with a DB URL set:
  - `pytest test/invariants/ -v`
  - Or run the check module as a script (e.g. `python -m test.invariants.checks`).
- **Live:** Poll the API at `GET /invariants` (see above and RUNBOOK.md).

---

## When changing the pipeline

- **New pipeline stage:** Must emit provenance for all data it produces; must update job status correctly; must not leave jobs in indefinite `queued`/`QUEUED` or `running`/`STARTED` without eventual completion or failure.
- **Schema change:** Ensure migrations do not violate the above (e.g. new feature tables should have provenance if they hold derived data).
- **New worker:** Follow the feature module contract and Kafka pipeline integrity rules in `.cursor/rules/tracefield.mdc`.
