You can fix it in two ways: proper pipeline (scalars from CSVs) or demo-only (seed so the exact analysis runs).

1. Pipeline fix: scalar features from uploaded files
Make scalar columns in uploaded CSVs flow into the feature store, similar to embeddings.

Backend

Option A – New worker (recommended)
A small worker (e.g. worker-scalar-features or a mode in an existing worker) that:

Is triggered per dataset (Kafka message or job table), with config: dataset id, list of columns to ingest (e.g. score, training_hours), and optionally column → feature_definition name.
Reads the dataset’s files from object storage (same as worker-embeddings).
For each row, gets entity_id via entity_map (dataset_id + source record id from the row).
For each configured column, ensures a feature definition exists (by name), then upserts into features (entity_id, dataset_id, feature_definition_id, value_num/value_text, provenance).
Emits provenance and updates job status. Idempotent and tolerant of out-of-order messages per project rules.
Option B – API-only job
Same logic in the API or a sync job: on “extract scalar features”, read dataset files, resolve entities via entity_map, write to feature_definitions + features. Simpler but heavier for large files; workers scale better.

UI

On Datasets, add something like “Extract scalar features” (or “Import columns as features”) next to “Extract embeddings”.
User picks the dataset and which columns to import (e.g. score, training_hours, age_group). Optionally name the feature definition or use column name.
Frontend calls a new API (e.g. POST /features/extract-scalar or POST /datasets/{id}/extract-scalar) with { "columns": ["score", "training_hours"] } (and maybe idColumn for row→entity).
Backend enqueues the worker job (or runs it) and returns job id; UI can poll job status like for embedding extraction.
Result: User uploads the two CSVs, runs resolution, then “Extract scalar features” on each dataset for the relevant columns. After that, “satisfaction vs training hours” works in the GUI with no seed.

2. Demo-only fix: seed for the two-dataset story
If the goal is only to make the demo run end-to-end without building the scalar pipeline yet:

Add (or extend) seed SQL that:
Inserts the two datasets (survey 2024, training 2024) and their metadata.
Inserts the five entities (Alice, Bob, Carol, Dave, Eve) and entity_map rows for both datasets (survey rec-* and training emp-* → same entity_ids).
Inserts feature definitions for score, training_hours, and optionally age_group.
Inserts features for each entity from both datasets (score and training_hours per person).
Don’t insert raw file content; the “content” is only in the CSVs for upload. So you have two choices:
A: Seed only structure + features; in the demo you still register/upload the two CSVs and show resolution, but skip “extract scalar” and run analysis using the pre-seeded features.
B: Seed so that dataset records and files exist and the seed data exactly matches what’s in docs/demo/survey_2024.csv and training_attendance_2024.csv; then the demo is “everything already loaded, show resolution and analysis”.
Result: The exact “satisfaction vs training hours” analysis works in the GUI for the demo, but you still don’t have a general “scalar from CSV” path until you add the worker/API above.

Summary

**Proper fix (implemented):** API `POST /datasets/{id}/extract-scalar` plus UI **Extract scalar features** on the Datasets page; user picks ID column and columns to import, backend reads dataset file(s), resolves entities via `entity_map`, upserts into `features`; job status is polled like embedding extraction. See Heat/Crime walkthrough Step 4b.
Quick fix: Seed data or the SQL script in docs/demo/seed_heatcrime_scalar_features.sql for automation; the GUI is the preferred path.