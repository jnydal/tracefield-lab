# Tracefield Lab — improvements backlog

Tracked gaps and follow-ups from pipeline/UI work (datasets, ingest, object storage, scalar features). For the Heat/Crime demo flow, see [DEMO_WALKTHROUGH_HEATCRIME.md](DEMO_WALKTHROUGH_HEATCRIME.md).

---

## Delivered (reference)

- **Scalar features from uploaded CSVs**: GUI **Extract scalar features** writes numeric/text columns into the feature store keyed by resolved entities (`POST /datasets/{id}/extract-scalar`). Analysis jobs can use those values without SQL seeds.
- **Resilience when object-store GET fails**: On ingest, the API stores **`ingest_columns_json`** (header names) and, for uploads **≤ 1 MB**, **`inline_file_b64`** so preview and scalar extract can fall back if MinIO/S3 read fails. See migration `017_dataset_file_ingest_cache.sql` and [ARCHITECTURE.md](../ARCHITECTURE.md) (API ingest / preview).
- **UI**: Column pickers prefer **attached CSV header** (browser) → registered schema → **`latestFileColumns`** → **`POST …/sync-file-metadata`** → preview API. **`POST …/extract-scalar-upload`** sends the CSV with the job so extraction does not depend on MinIO/S3 GET.
- **Heat/Crime demo: result_summary observability** (`created > 0` warning): Resolution jobs list now highlights `created: N` in amber and shows "⚠ new entities created — check alignment" when any records were created rather than matched, closing the last open item in EMBEDDING_MAPPING_BUG.txt Cause 3.
- **Feature availability in analysis job form** (§12): `GET /features/summary` LEFT JOINs feature definitions with the features table and returns `computedCount` per definition. The analysis job form uses this instead of the bare definitions list — option labels show computed row counts and a zero-count selection triggers an inline amber warning ("⚠ no computed rows — run scalar extract first").

---

## Open issues & improvements

### 1. No automated tests for ingest cache / scalar extract

**Gap:** The path “upload → DB columns + optional inline body → scalar extract without S3” is not covered by CI tests.

**Suggestion:** Integration test: ingest small CSV, stub or break S3 GET, assert scalar extract still completes and features exist; separate test with S3-only success.

---

### 2. Duplicate storage for small files (S3 + Postgres)

**Issue:** Files ≤ 1 MB are stored in object storage **and** as base64 in `dataset_files.inline_file_b64`. Doubles storage footprint for that tier and creates two sources of truth (mitigated by “S3 first, then inline”).

**Suggestions:**

- Document **retention** for `inline_file_b64` alongside raw objects ([NFR.md](../NFR.md) categories).
- Longer-term: optional **inline only on failed S3 verify** or **lazy backfill** after first failed GET (more complex).

---

### 3. Base64 in `TEXT` vs binary column

**Issue:** Inline file body is stored as base64 text (~33% overhead vs raw bytes).

**Suggestion:** Migrate to `BYTEA` (or equivalent) if inline storage grows; keep migration backward compatible.

---

### 4. Schema / Exposed typing for `ingest_columns_json`

**Issue:** Column is JSONB in SQL; Exposed maps it as nullable text. Works but is not type-expressive.

**Suggestion:** Use Exposed JSON/JSONB mapping if the stack supports it consistently across drivers.

---

### 5. Extra queries on `PUT /datasets/{id}`

**Issue:** After update, the handler loads `latestFileColumns`, `fileCount`, and `mappingsCount` via additional queries.

**Suggestion:** Acceptable for now; consolidate into one query or drop redundant fields from PUT response if clients only need them from `GET /datasets/{id}`.

---

### 6. Large files still fully dependent on object storage

**Issue:** Files **> 1 MB** have no inline fallback. Scalar extract and preview fail if S3 GET fails.

**Suggestions:** Raise cap with explicit ops limit, or **chunked / streaming** read path; avoid unbounded Postgres blobs.

---

### 7. `parseFullCsv` requires ≥ 2 non-blank lines for row maps

**Issue:** Historically, CSV with **header only** produced no parsed rows (empty column list from row keys). Header-only preview is now improved server-side for preview-rows; scalar extract still needs data rows to write features.

**Suggestion:** Document “header-only uploads cannot produce scalar features”; optional validation at ingest.

---

### 8. Demo / ops friction

**Issues encountered:**

- **`psql -f path` inside DB container** fails (path is container FS, not repo). **Fix:** pipe SQL from host (`< file.sql` or PowerShell `Get-Content … | psql`).
- **Existing datasets** before migration **017**: must **re-upload** once (or recreate) to populate `ingest_columns_json` / `inline_file_b64`.

**Suggestion:** Add a one-shot admin task or migration note in RUNBOOK (already partially there); consider **“Repair ingest metadata”** job that re-reads from S3 when healthy.

---

### 9. Embeddings worker still S3-only

**Issue:** `worker-embeddings` reads `object_uri` from DB; it does not use `inline_file_b64`. If S3 is broken, embeddings extract can still fail while scalar extract succeeds for small files.

**Suggestion:** Align worker with same fallback chain or document the limitation.

---

## UI / Researcher Experience

### 11. No pipeline wizard or guided flow (highest impact)

**Issue:** The five pipeline stages (Datasets → Entity Mappings → Features → Analysis Jobs → Results) have no connective tissue. There is no checklist, no prerequisite indicator, and no "you need X before Y" signal. The only guidance is the external demo walkthrough doc. Researchers must already know the correct sequence and configuration semantics; modal warnings exist for some gating but do not form a coherent flow.

**Suggestion:** Add a pipeline stage navigator or progress sidebar that shows completion state per stage and surfaces blockers (e.g. "embeddings required before resolution", "no features computed yet"). Even a lightweight status summary per dataset would significantly reduce cognitive load.

---

### 13. Entity resolution: no schema-linked column pickers

**Issue:** Join keys and semantic fields in the automated resolution form are plain free-text inputs. Researchers type column names from memory, with no connection to the actual columns on the source datasets. The distinction between join key and semantic field is architecturally critical (wrong semantic fields can collapse all entities into one), but there is no in-app guidance, warning, or preview of the outcome.

**Suggestion:**
- Load the column list for the selected datasets and offer a column picker (multi-select or combobox) for join keys and semantic fields.
- Add a tooltip or inline warning explaining the semantic field risk (collapse behaviour).
- Optional: show a "preview entity count" dry run before submitting the resolution job.

---

### 14. Manual entity mapping uses raw UUIDs

**Issue:** The manual mapping tab requires raw `dataset_id` and `entity_id` UUIDs, with no name lookup or picker. A UUID typo produces no meaningful error until a downstream job fails. This is more error-prone than even the free-text column name issue.

**Suggestion:** Replace UUID inputs with searchable dataset/entity pickers that resolve to IDs on submit, consistent with the dataset dropdown already used in the automated resolution form.

---

### 15. Analysis results show truncated feature IDs, not names

**Issue:** The results table displays truncated internal feature IDs rather than human-readable feature definition names. For a research tool where interpreting results is the primary goal, this significantly weakens the results view.

**Suggestion:** Join on feature definitions at query time (or in the API response) and display the definition name alongside or instead of the raw ID.

---

### 16. Embeddings UI: single `textColumn` vs multi-column API

**Issue:** `FeatureExtractRequest` in `pipeline-api.ts` supports `textColumns` (array), but the UI only ever sends a single `textColumn`. Researchers with multi-column text inputs cannot use the full capability through the UI.

**Suggestion:** Extend the embeddings modal to allow selecting multiple text columns (using the existing column picker infrastructure) and send them as `textColumns`.

---

### 17. No exploratory discovery scan — system is confirmatory only

**Issue:** The current analysis workflow is researcher-directed and confirmatory: the researcher selects two datasets, forms a hypothesis, and the system validates or invalidates it. There is no way to say "here is a pool of datasets and features — find me what is surprising." The intellectual work of identifying candidate confounders, mediators, or unexpected associations remains entirely with the researcher. This limits Tracefield to an instrument for testing hypotheses rather than a tool for generating them.

**Context:** The Heat/Crime demo illustrates the gap: the researcher must already know to bring in temperature as a candidate confounder. The system confirms the triangular pattern once the researcher has assembled the three datasets; it would not have surfaced temperature unprompted from a larger pool.

**Suggestion:** Add a **discovery scan** job type:
- Researcher selects a pool of datasets (≥ 2) and a feature set (or all available scalar features across those datasets).
- The system runs all pairwise correlation combinations across the pool and ranks results by correlation strength (absolute r or ρ).
- Results are presented as a ranked table of associations, flagging pairs that exceed a configurable threshold.
- **Confounder hint**: where a third feature Z correlates with both members of a high-correlation pair (X, Y) at similar strength, surface it as a candidate confounding variable.
- All scan results carry full provenance identical to a standard analysis job.

**Constraints to consider:**
- Combinatorial explosion: a pool of N features produces N(N−1)/2 pairwise jobs. Needs a cap or sampling strategy for large feature pools.
- Multiple-testing correction becomes critical at scale — Benjamini–Hochberg (already supported per-job) should apply across the full scan result set.
- Discovery scan results should be clearly labelled as exploratory / hypothesis-generating, not confirmatory, in the UI and provenance records.
- Effect sizes and confidence intervals still required alongside p-values (existing NFR).

---

## How to use this doc

- Treat items as **backlog**, not blockers for the demo, unless marked critical for your environment.
- When closing an item, move a one-line summary to **Delivered** (or ARCHITECTURE/RUNBOOK) and link the PR.
