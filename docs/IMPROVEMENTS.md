# Tracefield Lab — improvements backlog

Tracked gaps and follow-ups from pipeline/UI work (datasets, ingest, object storage, scalar features). For the Heat/Crime demo flow, see [DEMO_WALKTHROUGH_HEATCRIME.md](DEMO_WALKTHROUGH_HEATCRIME.md).

---

## Delivered (reference)

- **Scalar features from uploaded CSVs**: GUI **Extract scalar features** writes numeric/text columns into the feature store keyed by resolved entities (`POST /datasets/{id}/extract-scalar`). Analysis jobs can use those values without SQL seeds.
- **Resilience when object-store GET fails**: On ingest, the API stores **`ingest_columns_json`** (header names) and, for uploads **≤ 1 MB**, **`inline_file_b64`** so preview and scalar extract can fall back if MinIO/S3 read fails. See migration `017_dataset_file_ingest_cache.sql` and [ARCHITECTURE.md](../ARCHITECTURE.md) (API ingest / preview).
- **UI**: Column pickers prefer **attached CSV header** (browser) → registered schema → **`latestFileColumns`** → **`POST …/sync-file-metadata`** → preview API. **`POST …/extract-scalar-upload`** sends the CSV with the job so extraction does not depend on MinIO/S3 GET.

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

### 10. the issue is with how your current build wires features to entities.

From the DB:

total_incidents is attached to 12 time_period entities whose display_name is like NYC-CRIME-2023-01 … NYC-CRIME-2023-12.
units_sold_thousands is attached to 12 different time_period entities whose display_name is like ICECREAM-JAN-2023 … ICECREAM-DEC-2023.
So instead of both features landing on the same 12 canonical time periods, you effectively have 24 distinct entities: 12 “crime” time_periods and 12 “ice‑cream” time_periods, with no overlap. That’s why the analysis still fails.

This tells me your resolver is configured to create new entities separately for each dataset and never unify them, so the scalar extraction is behaving exactly as coded.

Given you’re running the stock Tracefield Lab stack (no local resolver changes mentioned), this is now a project bug / config mismatch rather than something you can fix purely through the UI in the demo.

I recommend we do this next (I can walk you through, or make the code changes for you):

Inspect the resolver’s resolution logic to confirm how it:

Decides whether to reuse an existing time_period entity vs. create a new one.
Writes display_name and external_ids so that crime and ice‑cream rows can converge on a shared entity.
Align it with the walkthrough’s intent:

When resolving time_period for multiple datasets, use semantic similarity on the month label text (month_label vs. period_label) to reuse entities, not always create new ones.
Ensure the feature ingest pipeline uses the resolved entity_id (from entity_map) rather than implicitly treating each dataset row as its own distinct entity.
After the fix, we re-run:

Resolution jobs for crime and ice‑cream
Scalar extraction jobs
Then your analysis job (which should then succeed).
If you’d like me to continue debugging this in code, tell me your preference:

Option A: “Please fix the resolver/feature-wiring in code so the demo works as documented.”
Option B: “Show me exactly which files to open and what to change; I’ll make the edits.”
Either way, I’ll locate the relevant resolver and feature-extraction code in your repo and adjust it so that both features end up on the same canonical time_period entities, matching the demo doc.

---

## How to use this doc

- Treat items as **backlog**, not blockers for the demo, unless marked critical for your environment.
- When closing an item, move a one-line summary to **Delivered** (or ARCHITECTURE/RUNBOOK) and link the PR.
