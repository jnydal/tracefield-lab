# Tracefield Lab — Demo Walkthrough

A **human-relatable** walkthrough for demos. Use this to show the system end-to-end in about 15–20 minutes.

---

## The story (what you’ll say)

> “We have **two datasets** that look unrelated: a **team satisfaction survey** from HR (scores, age groups) and **training attendance** from L&D (hours, departments). They use different IDs and different name formats—‘Alice’ in one, ‘Alice Chen’ in the other. Tracefield lets us **bring both in**, **resolve who is who** across the two sources, then **ask a question we couldn’t answer in either system alone**: *Does satisfaction correlate with training attendance?* That’s correlation discovery across silos—with full provenance so we can reproduce it.”

**Why it matters:** Most tools work on one dataset. Tracefield Lab is built for **finding connections across heterogeneous sources**. Entity resolution maps “the same thing” across datasets; the feature store and analysis then surface correlations that only appear when you cross-reference.

---

## Demo data (real content)

Two sample CSVs are in the repo so you have real content to upload:

| File | Description | Key columns |
|------|-------------|-------------|
| `docs/demo/survey_2024.csv` | Satisfaction survey (HR) | `id`, `name`, `score`, `age_group`, `comments` |
| `docs/demo/training_attendance_2024.csv` | Training attendance (L&D) | `employee_id`, `full_name`, `training_hours`, `department`, `notes` |

The same five people appear in both, under different IDs and name forms (e.g. Alice ↔ Alice Chen, Bob ↔ Robert Smith). Resolution will link them to one canonical person per entity so we can analyze across both datasets.

---

## Before you start

- **Stack running:** `docker compose up -d --build`
- **Kafka topics:**  
  `docker compose exec -T kafka rpk topic create ingest`  
  `docker compose exec -T kafka rpk topic create features`  
  `docker compose exec -T kafka rpk topic create analysis`
- **Sample files:** Use `docs/demo/survey_2024.csv` and `docs/demo/training_attendance_2024.csv` (paths from repo root).
- **UI:** Open the app (e.g. https://tracefieldlab.thor-nydal.no or `http://localhost:5173`). Log in if required.

**Optional shortcut:** To get scalar features (score, training_hours) and feature definitions pre-filled so the analysis step works immediately, you can load the seed data first:  
`docker compose exec -T db psql -U postgres -d tracefield -f - < infra/sql/099_seed_test_data.sql`  
Then register and upload the two CSVs anyway to show the “two datasets” story, and use Entity Mappings and Analysis to complete the demo.

---

## Step 1: Register and upload the first dataset (≈2 min)

**What you say:** “First we register the satisfaction survey. It comes from HR—different system, different ID scheme.”

**In the UI:**

1. Go to **Datasets**.
2. Click **Create dataset** (or equivalent).
3. Fill in:
   - **Name:** `Team satisfaction survey 2024`
   - **Source:** e.g. `https://hr.example.org/surveys/2024`
   - **License:** e.g. `CC-BY-4.0`
   - **Schema:** Paste the first few lines of `docs/demo/survey_2024.csv` and use **Infer schema**, or add columns: `id`, `name`, `score`, `age_group`, `comments`.
4. Create the dataset, then use **Upload file** and select `docs/demo/survey_2024.csv`.

**Content reference** (from `docs/demo/survey_2024.csv`):

```csv
id,name,score,age_group,comments
rec-001,Alice,85.5,25-34,Happy with flexibility and team support
rec-002,Bob,72.0,35-44,Would like more clarity on goals
rec-003,Carol,91.2,25-34,Great culture and growth opportunities
rec-004,Dave,68.0,35-44,Needs better tools and training
rec-005,Eve,88.0,25-34,Very satisfied with management
```

---

## Step 2: Register and upload the second dataset (≈2 min)

**What you say:** “Now we add the second source—training attendance from L&D. Different system, different IDs and name format. By itself it doesn’t tell us about satisfaction; we’ll connect them.”

**In the UI:**

1. **Datasets** → **Create dataset**.
2. Fill in:
   - **Name:** `Training attendance 2024`
   - **Source:** e.g. `https://ld.example.org/training/2024`
   - **License:** e.g. `CC-BY-4.0`
   - **Schema:** Paste a few lines of `docs/demo/training_attendance_2024.csv` and use **Infer schema**, or add: `employee_id`, `full_name`, `training_hours`, `department`, `notes`.
3. Create, then **Upload file** → `docs/demo/training_attendance_2024.csv`.

**Content reference** (from `docs/demo/training_attendance_2024.csv`):

```csv
employee_id,full_name,training_hours,department,notes
emp-101,Alice Chen,24,Engineering,Completed safety and compliance
emp-102,Robert Smith,8,Operations,Basic onboarding only
emp-103,Carol Jones,32,Engineering,Full certification track
emp-104,David Lee,12,Sales,Product training
emp-105,Eve Martinez,28,Engineering,Leadership and technical
```

---

## Step 3: Entity resolution — link the same people across both datasets (≈3 min)

**What you say:** “The two files use different IDs and names. We need to say which rows in the survey and which rows in training are the *same person*. That’s entity resolution. Once they’re linked, we can combine features from both and run analysis across datasets.”

**In the UI:**

1. Go to **Entity Mappings**.
2. Use the **Automated (embeddings)** flow so the system can match names across the two sources.
3. **First dataset (survey):** Create a resolution job for the survey dataset:
   - **Job name:** e.g. `Resolve survey 2024`
   - **Dataset:** Team satisfaction survey 2024
   - **Entity type:** `person`
   - **Join keys:** `id`
   - **Semantic fields:** `name` (so “Alice” gets an embedding)
   - **Create new entities if no match:** Yes (so the first run creates canonical persons).
   - **Records:** Add the five survey rows (e.g. `rec-001` / name `Alice`, etc., as in the CSV).
4. Run the job and wait until it completes. You now have five entities (Alice, Bob, Carol, Dave, Eve) and mappings from the survey.
5. **Second dataset (training):** Create a resolution job for the training dataset:
   - **Job name:** e.g. `Resolve training 2024`
   - **Dataset:** Training attendance 2024
   - **Entity type:** `person`
   - **Join keys:** `employee_id`
   - **Semantic fields:** `full_name` (so “Alice Chen” can match “Alice”)
   - **Create new entities if no match:** No (so matches link to the entities you already created).
   - **Records:** Add the five training rows (e.g. `emp-101` / full_name `Alice Chen`, etc.).
6. Run the job. The resolver will match “Alice Chen” to Alice, “Robert Smith” to Bob, and so on. After this, each canonical person has mappings from *both* datasets.

**Manual alternative:** If you prefer or if resolution isn’t available, you can add manual mappings: for each survey row and each training row, map dataset + source record ID to the same entity ID (you’ll need entity IDs from the first resolution run or from seed data).

---

## Step 4: Feature extraction (≈2 min)

**What you say:** “We need features from both datasets on the same entities—satisfaction score from the survey, training hours from L&D. We also extract text embeddings so we can do similarity search or embedding-based analysis later.”

**In the UI:**

1. **Datasets** → open **Team satisfaction survey 2024** → **Extract embeddings** (or equivalent). Choose text column `comments` (or `name`), ID column `id`. Run and wait for the job to finish.
2. **Datasets** → open **Training attendance 2024** → **Extract embeddings**. Choose text column `notes` (or `full_name`), ID column `employee_id`. Run and wait.

Scalar features (e.g. `score`, `training_hours`) may come from a feature worker that reads your uploaded CSVs, or from seed data. If your setup doesn’t create them automatically, load the seed data (see “Before you start”) so that the analysis step has numeric features to run on.

---

## Step 5: Run a cross-dataset analysis (≈2 min)

**What you say:** “Now we ask a question that only makes sense once the two datasets are linked: *Does satisfaction score (from HR) correlate with training hours (from L&D)?* We run a statistical test across the two feature sets.”

**In the UI:**

1. Go to **Analysis jobs** (or **Analysis**).
2. Create a new job, e.g.:
   - **Name:** `Satisfaction vs training hours (cross-dataset)`
   - **Left feature:** `score` (from the survey dataset)
   - **Right feature:** `training_hours` (from the training dataset), or whatever scalar feature your setup exposes for training.
   - **Test:** e.g. Spearman (two numeric variables)
   - **Correction:** e.g. Benjamini–Hochberg
3. Submit and wait until the job completes.

If scalar features aren’t available yet, run a job that uses embeddings (e.g. embedding dimension vs a scalar, or embedding clustering) to show that analysis runs on the unified feature store.

---

## Step 6: Show results and provenance (≈2 min)

**What you say:** “Results show the test we ran, p-value, effect size, and correction. This result is only possible because we joined two heterogeneous datasets by entity. Everything is tied to provenance so we can reproduce it.”

**In the UI:**

1. Go to **Analysis results** (or open the completed job).
2. Show the result row: test name, p-value, effect size, correction.
3. If the UI exposes provenance, show one record and say: “This is the audit trail for papers or audits.”

---

## One-line summary for your boss

> “We brought in two siloed datasets—satisfaction survey and training attendance—resolved the same people across both, extracted features, and ran a cross-dataset analysis (satisfaction vs training hours) with proper correction and full provenance.”

---

## If something breaks

- **API:** `curl http://localhost:8000/healthz`
- **Logs:** `docker compose logs -f api` or `docker compose logs -f worker-analysis`
- **DB:** See RUNBOOK.md for connection and migration commands.
- **Full workflow test:** `./scripts/run-integration-tests.ps1` (or `.sh`) to validate pipeline from seed data to analysis and provenance.

---

## Optional: “Similar entities” (≈1 min)

**What you say:** “Because we store embeddings, we can find entities that are *semantically similar* to a given person—useful when you have many datasets and want to discover who might be the same or similar.”

**In the UI:** On **Entity Mappings**, use **Find similar** on a mapping row if available.

**API:**

```bash
curl "http://localhost:8000/entities/<ENTITY_ID>/similar?limit=10"
```

---

*Last updated to match ARCHITECTURE.md, AGENT.md, and RUNBOOK.md. Demo data: `docs/demo/survey_2024.csv`, `docs/demo/training_attendance_2024.csv`.*
