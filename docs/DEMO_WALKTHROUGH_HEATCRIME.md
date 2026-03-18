# Tracefield Lab — Heat, Crime & Ice Cream Demo Walkthrough

A **causal discovery** walkthrough showing how Tracefield Lab can separate genuine
correlation from spurious association by surfacing a hidden confounding variable.
Runtime: ~20–25 minutes.

---

## The story (what you'll say)

> "We have **two datasets** from totally different domains — NYPD monthly crime
> statistics and a New York City ice cream sales report. After we resolve months onto
> the same canonical entities (shared **`canonical_month`** key in the demo data), we
> run a correlation analysis and get an alarming result: **ice cream sales and crime
> rates are strongly correlated.** r ≈ 0.97, p < 0.001.
>
> Does selling ice cream *cause* crime? Obviously not — but the correlation is real
> and the statistics are honest. To understand *why* it exists, we bring in a **third
> dataset**: NYC monthly temperature records. Tracefield resolves all three onto
> the same months, extracts features, and we run correlations. **Temperature
> correlates as strongly with crime and with ice cream as they do with each other** —
> the classic confounding pattern. (Formal partial correlation “holding heat fixed”
> would be a next analysis step; here we *show* the shared driver story with pairwise
> results and provenance.)"

**Why it matters:** Correlation without context is noise. Tracefield Lab is built
for researchers who need to **cross-reference heterogeneous sources**, control for
confounders, and arrive at conclusions that are both statistically sound and
reproducible from provenance alone.

---

## The data (three real-structure CSVs)

Three sample files are in the repo. Each uses a **different operational ID scheme**
for the same 12 calendar months — that part is realistic siloed data.

So that Tracefield can **fuse** those silos reliably (same canonical entity per month,
correct scalar pairing for analysis), every row also carries a shared
**`canonical_month`** value (`2023-01` … `2023-12`). In a real deployment this might
come from a master calendar, data warehouse surrogate key, or ETL — here it is
embedded in the files so **exact-match resolution** aligns months without depending
on embedding similarity alone.

| File | Domain | Operational ID | Federation key + analysis columns |
|------|---------|----------------|-------------------------------------|
| `docs/demo/nyc_crime_2023.csv` | NYPD crime statistics | `crime_record_id` | `canonical_month`, `month_label`, `total_incidents`, … |
| `docs/demo/nyc_icecream_sales_2023.csv` | Ice cream vendor sales | `period_id` | `canonical_month`, `period_label`, `units_sold_thousands`, … |
| `docs/demo/nyc_temperature_2023.csv` | NOAA-style temperature log | `temp_record_id` | `canonical_month`, `month_reference`, `avg_temp_f`, … |

**Join keys in resolution (Step 3 / 7):** list the **native ID first**, then
`canonical_month` (comma-separated). The native ID stays the `source_record_id` for
scalar extract; `canonical_month` is what matches rows to the **same** canonical
`time_period` entity across datasets.

### Data preview — the spurious correlation at a glance

| Month | Avg Temp (°F) | Crime Incidents | Ice Cream Sales (k units) |
|-------|-------------|-----------------|--------------------------|
| Jan   | 36           | 5,821           | 11.8                     |
| Apr   | 59           | 6,912           | 38.4                     |
| Jul   | 83           | 10,412          | 148.2                    |
| Oct   | 63           | 7,612           | 51.6                     |
| Dec   | 41           | 5,908           | 15.9                     |

The seasonal pattern is unmistakable. Temperature moves first; crime and ice cream
follow in lockstep.

---

## Before you start

- **Stack running:** `docker compose up -d --build`
- **Kafka topics:**
  ```
  docker compose exec -T kafka rpk topic create ingest
  docker compose exec -T kafka rpk topic create features
  docker compose exec -T kafka rpk topic create analysis
  ```
- **Sample files:** `docs/demo/nyc_crime_2023.csv`, `docs/demo/nyc_icecream_sales_2023.csv`, `docs/demo/nyc_temperature_2023.csv`
- **UI:** Open the app (e.g. https://tracefieldlab.thor-nydal.no or `http://localhost:5173`).

### Verify resolution jobs will be processed

Resolution jobs are processed by the **resolver** service. It polls the database every few seconds for jobs with status `queued`, runs resolution, then sets status to `completed` or `failed`. To be sure jobs can and will run:

1. **Resolver is running**  
   With Docker: `docker compose ps` — the `resolver` service should be up and healthy.  
   Health check: `curl -s http://localhost:8000/healthz` (if the resolver is mapped to port 8000; adjust host/port if your stack exposes it elsewhere). You should see `{"status":"ok","service":"resolver"}`.

2. **Jobs are created with status `queued`**  
   When you click "Create resolution job" in the UI, the API inserts a row into `resolution_jobs` with `status = 'queued'`. The resolver only picks up rows where `status = 'queued'`.

3. **After creating a job**  
   On **Entity Mappings**, the resolution jobs table shows each job’s status. Within a few seconds to a minute (depending on load and model startup), a `queued` job should move to `running` then `completed`. The first job may take longer because the resolver loads the BGE embedding model on first use. If a job stays `queued` for several minutes, check resolver logs: `docker compose logs resolver`.

---

## Phase 1 — The spurious correlation

*Goal: show that two unrelated datasets produce a striking, statistically real
but causally meaningless correlation.*

---

### Step 1: Register and upload the crime dataset (≈2 min)

**What you say:** "First dataset: NYPD monthly crime totals. This comes from an
operational policing system — it uses its own record IDs and has no concept of ice
cream."

**In the UI:**

1. Go to **Datasets** → **Create dataset**.
2. Fill in:
   - **Name:** `NYC Crime Statistics 2023`
   - **Source:** `https://data.cityofnewyork.us/Public-Safety/`
   - **License:** `Public Domain (NYC Open Data)`
   - **Schema:** Paste the first few lines of `nyc_crime_2023.csv` and use
     **Infer schema**, or add columns: `crime_record_id`, `canonical_month`,
     `month_label`, `total_incidents`, `violent_incidents`, `property_incidents`,
     `aggravated_assault`, `robbery`, `source_notes`.
3. Create the dataset, then **Upload file** → `docs/demo/nyc_crime_2023.csv`.

**Content reference** (from `docs/demo/nyc_crime_2023.csv`):

```csv
crime_record_id,canonical_month,month_label,total_incidents,violent_incidents,property_incidents,aggravated_assault,robbery,source_notes
NYC-CRIME-2023-01,2023-01,January 2023,5821,1204,4617,612,592,"NYPD CompStat, monthly aggregate"
NYC-CRIME-2023-07,2023-07,July 2023,10412,2164,8248,1096,1068,"NYPD CompStat, monthly aggregate"
NYC-CRIME-2023-12,2023-12,December 2023,5908,1227,4681,622,606,"NYPD CompStat, monthly aggregate"
```

---

### Step 2: Register and upload the ice cream sales dataset (≈2 min)

**What you say:** "Second dataset: ice cream vendor sales from a completely different
source — a retail aggregator. Different IDs, different month format, zero connection
to the crime system."

**In the UI:**

1. **Datasets** → **Create dataset**.
2. Fill in:
   - **Name:** `NYC Ice Cream Sales 2023`
   - **Source:** `https://nyc-retail-aggregator.example.com/icecream/2023`
   - **License:** `CC-BY-4.0`
   - **Schema:** Add columns: `period_id`, `canonical_month`, `period_label`,
     `units_sold_thousands`, `revenue_usd_thousands`, `active_vendor_locations`,
     `top_product`, `notes`.
3. Create, then **Upload file** → `docs/demo/nyc_icecream_sales_2023.csv`.

**Content reference** (from `docs/demo/nyc_icecream_sales_2023.csv`):

```csv
period_id,canonical_month,period_label,units_sold_thousands,revenue_usd_thousands,active_vendor_locations,top_product,notes
ICECREAM-JAN-2023,2023-01,Jan 2023,11.8,94,48,Classic Vanilla,"Mostly indoor mall kiosks; street carts closed"
ICECREAM-JUL-2023,2023-07,Jul 2023,148.2,1186,512,Mango Sorbet,"Peak summer; heat wave boosted sales"
ICECREAM-DEC-2023,2023-12,Dec 2023,15.9,127,56,Hot Cocoa Float,"Holiday specials only; mainly indoor venues"
```

---

### Step 3: Entity resolution — link calendar months across both datasets (≈4 min)

**What you say:** "Crime uses NYPD record IDs; ice cream uses retail period IDs — they
still don't *know* about each other operationally. We added a **`canonical_month`**
key (like a warehouse would) so Tracefield can **exact-match** every row to the same
calendar month entity. Same feature values land on the same entity; analysis is
meaningful."

**In the UI:**

**Option A — Use all ingested rows (recommended for this demo):**  
1. Go to **Entity Mappings**.
2. **First resolution job — from the crime dataset:**
   - **Job name:** `Resolve months from crime data`
   - **Dataset:** NYC Crime Statistics 2023
   - **Entity type:** `time_period`
   - **Join keys:** `crime_record_id, canonical_month`  
     *(native ID first — keeps `entity_map.source_record_id` = crime row id for scalar extract; `canonical_month` is stored on the entity for cross-dataset matching.)*
   - **Semantic fields:** **leave empty** *(critical)*  
     *If you set `month_label` here, embeddings for “January 2023”, “February 2023”, … are often all similar enough to pass the default threshold. The resolver then maps **many different months onto the same entity** (e.g. everything collapses to “September 2023”). Empty semantic fields → no semantic step → **one new entity per crime row** → 12 distinct months.*
   - **Create new entities if no match:** Yes
   - Check **Use all ingested rows from this dataset** (12 rows). Create the job and wait for completion.  
   *You should see **12 mappings**, each to a **different** entity (display names may look like `NYC-CRIME-2023-01` … — that’s fine).*
3. **Second resolution job — from the ice cream dataset:**
   - **Job name:** `Resolve months from ice cream data`
   - **Dataset:** NYC Ice Cream Sales 2023
   - **Entity type:** `time_period`
   - **Join keys:** `period_id, canonical_month`
   - **Semantic fields:** leave empty *(exact match on `canonical_month` should attach every row to the right month; avoid semantic fallback creating duplicates.)*
   - **Create new entities if no match:** Yes *(safety net; expect **0 created** if crime step succeeded)*
   - Check **Use all ingested rows from this dataset** (12 rows). Create the job and wait.

**Option B — Manual records:**  
Include `canonical_month` in keys (e.g. `crime_record_id: NYC-CRIME-2023-01, canonical_month: 2023-01, month_label: January 2023`). Use the same **join key order** as Option A.

**Point to make:** "We created twelve separate month entities from crime without fuzzy matching so months don’t collapse. Then the shared **`canonical_month`** key **exact-matches** ice cream onto those same twelve — no ambiguous embeddings for that link."

**If your Mappings table already looks wrong** (many rows pointing at the same month entity, lots of **semantic** on crime): delete those mappings (and orphaned entities if needed), then re-run Step 3 with **empty semantic fields** on the crime job as above.

---

### Step 4: Feature extraction (≈2 min)

**What you say:** "Now we pull out the numbers we care about as features on each
time period entity: total crime incidents from one source, ice cream units sold from
the other."

**Before you start:** Make sure Step 3 is complete — both resolution jobs must show **Completed** on the Entity Mappings page. The Extract embeddings modal requires **Files: 1 · Mappings: 12** (or similar); if you see "Mappings: 0", the resolution jobs have not finished or did not run. Wait for them to complete, then open Extract embeddings again (counts refresh when the modal opens).

**In the UI:**

1. **Datasets** → open **NYC Crime Statistics 2023** → **Extract embeddings**.
   - Text column: `month_label`, ID column: `crime_record_id`.
   - Run and wait. (Feature definitions for analysis are created in the UI — see Step 5 "Before you start" and the note below.)
2. **Datasets** → open **NYC Ice Cream Sales 2023** → **Extract embeddings**.
   - Text column: `period_label` (or `notes`), ID column: `period_id`. Run and wait.

> **Note on scalar features:** Create the feature definitions in the UI (**Features** → create `total_incidents` and `units_sold_thousands` as in Step 5 "Before you start") so they appear in the analysis dropdowns. The analysis step also needs numeric *values* for these features on the resolved `time_period` entities; if your setup doesn't populate those automatically via an ingest or feature worker, you may need to load or sync that data separately.

---

### Step 4b: Extract scalar features (required before Step 5)

The analysis worker needs **numeric feature values** in the feature store (e.g. `total_incidents` and `units_sold_thousands` per resolved time period). "Extract embeddings" only fills the embeddings table; it does not write these scalars. To avoid a **failed** analysis job with *"No overlapping entity-feature data for left and right feature sets"*, use the GUI to import scalar columns from your uploaded CSVs:

1. **Datasets** → open **NYC Crime Statistics 2023** → click **Extract scalar features**.
2. **CSV from your computer:** choose `nyc_crime_2023.csv` (the same file you uploaded). That fills the column list and runs extraction from your browser copy — **required** if the API cannot read cloud storage (common on split prod setups). If columns already appear without choosing a file, you can use those instead.
3. In the modal:
   - **ID column:** `crime_record_id` (links each row to the resolved time-period entity).
   - **Columns to import as features:** check `total_incidents` (and any other numeric columns you want). Feature definitions are created by name if they don’t exist.
4. Click **Start extraction** and wait for the job to finish (status **finished**).
5. Repeat for **NYC Ice Cream Sales 2023**: attach `nyc_icecream_sales_2023.csv`, ID `period_id`, check `units_sold_thousands`. Run and wait.
6. Then proceed to Step 5. The Phase 1 analysis job should complete successfully.

This flow is the **proper pipeline** described in [IMPROVEMENTS.md](IMPROVEMENTS.md): scalar columns from uploaded files flow into the feature store so analysis works without seed scripts.

**If columns still don’t load:** Use **CSV from your computer** in the modal (same demo file) — that path does not need MinIO. For persistent ingest metadata, apply migration `017` and rebuild the API (`psql … < infra/sql/017_dataset_file_ingest_cache.sql` from repo root on the host).

---

### Step 5: Run the spurious correlation analysis (≈2 min)

**What you say:** "Here's the moment. We ask the system: does crime correlate with
ice cream sales? Let's see what it finds."

**Before you start:** The Left/Right feature dropdowns are filled from **Features** (feature definitions). Create the ones you need in the UI so they appear in the dropdowns:

1. Go to **Features** (in the app nav).
2. **Create** two feature definitions (use "Feature name" and "Value type", submit for each):
   - Name: `total_incidents`, Value type: `float` (or `number`).
   - Name: `units_sold_thousands`, Value type: `float` (or `number`).
3. For later steps (temperature), you can add now or when you get there: `avg_temp_f` and `heat_index_f` (value type `float`).

Then go to **Analysis jobs**; the Left/Right feature dropdowns should list these names.

**In the UI:**

1. Go to **Analysis jobs** → **Create new job**.
2. Fill in:
   - **Name:** `Crime vs ice cream sales — Phase 1 (spurious)`
   - **Left feature:** `total_incidents` (from crime dataset)
   - **Right feature:** `units_sold_thousands` (from ice cream dataset)
   - **Test:** Spearman rank correlation (robust to non-normality)
   - **Correction:** Benjamini–Hochberg (required even for a single test — habit matters)
3. Submit. Wait for the job to complete.

**What you'll see:**

| Metric | Expected result |
|--------|----------------|
| Spearman r | ≈ 0.97 |
| p-value | < 0.001 |
| Effect size | Large |
| Interpretation | Highly significant positive correlation |

**What you say:** "r = 0.97. p-value under 0.001. By any conventional measure this
is a near-perfect correlation between ice cream sales and crime. If we stopped here —
if this were two columns in a spreadsheet — someone might actually publish this.
But Tracefield doesn't let us stop here. Provenance tells us *what went in*. The
question is: what's missing?"

---

## Phase 2 — Identifying heat as the causal factor

*Goal: introduce temperature as a third dataset, cross-reference all three, and
show that temperature explains the correlation entirely.*

---

### Step 6: Register and upload the temperature dataset (≈2 min)

**What you say:** "Now we bring in a third source: NOAA-style monthly temperature
records for New York City. Again, a completely different ID scheme, a different
system, and — critically — a dataset that neither the crime team nor the ice cream
vendor ever thought to combine with theirs."

**In the UI:**

1. **Datasets** → **Create dataset**.
2. Fill in:
   - **Name:** `NYC Monthly Temperature 2023`
   - **Source:** `https://www.ncdc.noaa.gov/cdo-web/datasets/GHCND/`
   - **License:** `Public Domain (NOAA)`
   - **Schema:** Add columns: `temp_record_id`, `canonical_month`, `month_reference`,
     `avg_temp_f`, `avg_temp_c`, `heat_index_f`, `days_above_80f`, `days_below_32f`,
     `precipitation_inches`, `notes`.
3. Create, then **Upload file** → `docs/demo/nyc_temperature_2023.csv`.

**Content reference** (from `docs/demo/nyc_temperature_2023.csv`):

```csv
temp_record_id,canonical_month,month_reference,avg_temp_f,avg_temp_c,heat_index_f,days_above_80f,days_below_32f,precipitation_inches,notes
TEMP-NYC-JAN23,2023-01,January_2023,36.1,2.3,34.8,0,18,3.41,"Below-average temperatures; several hard freezes"
TEMP-NYC-JUL23,2023-07,July_2023,83.2,28.4,89.6,19,0,4.01,"Hottest month; multiple heat waves; 3-day 95°F+ stretch"
TEMP-NYC-DEC23,2023-12,December_2023,41.3,5.2,39.7,0,9,3.18,"Cold; freeze events returned"
```

---

### Step 7: Resolve temperature records onto the same time period entities (≈3 min)

**What you say:** "Temperature uses yet another ID scheme and label format — same
`canonical_month` key attaches it to the exact same twelve entities."

**In the UI:**

1. **Entity Mappings** → create a new resolution job:
   - **Job name:** `Resolve months from temperature data`
   - **Dataset:** NYC Monthly Temperature 2023
   - **Entity type:** `time_period`
   - **Join keys:** `temp_record_id, canonical_month`
   - **Semantic fields:** leave empty *(rely on `canonical_month` exact match to the existing 12 entities)*
   - **Create new entities if no match:** No
   - Check **Use all ingested rows** (12 rows).
2. Run and wait. All 12 rows should **exact-match** onto the existing canonical months.

**Point to make:** "Three operational ID schemes, one shared period key, one entity
graph — that's cross-silo federation with reproducible joins."

---

### Step 8: Extract temperature features (≈2 min)

**What you say:** "Same pattern as Phase 1: embeddings for semantic context, **scalar
extract** for the numbers we analyze."

**In the UI:**

1. **Datasets** → open **NYC Monthly Temperature 2023** → **Extract embeddings**.
   - Text column: `notes`, ID column: `temp_record_id`. Run and wait.
2. **Extract scalar features** (required for Steps 9–10, same as Step 4b):
   - Open **Extract scalar features**, attach `nyc_temperature_2023.csv` if needed.
   - **ID column:** `temp_record_id`
   - **Columns:** check `avg_temp_f` and `heat_index_f` (and any other numeric columns you want).
   - Run until status **finished**.
3. Ensure feature definitions `avg_temp_f` and `heat_index_f` exist (**Features** → create if missing).

---

### Step 9: Run the confounded analysis — crime vs temperature (≈1 min)

**What you say:** "Let's check: does temperature actually correlate with crime?"

**In the UI:**

1. **Analysis jobs** → **Create new job**.
2. Fill in:
   - **Name:** `Crime vs temperature`
   - **Left feature:** `total_incidents`
   - **Right feature:** `avg_temp_f`
   - **Test:** Spearman
   - **Correction:** Benjamini–Hochberg
3. Submit. Wait for results.

**What you'll see:** r ≈ 0.96–0.98, p < 0.001. Temperature is nearly as strongly
correlated with crime as ice cream was.

---

### Step 10: Run the confounded analysis — ice cream vs temperature (≈1 min)

**What you say:** "And temperature vs ice cream?"

**In the UI:**

1. **Analysis jobs** → **Create new job**.
2. Fill in:
   - **Name:** `Ice cream vs temperature`
   - **Left feature:** `units_sold_thousands`
   - **Right feature:** `avg_temp_f`
   - **Test:** Spearman
   - **Correction:** Benjamini–Hochberg
3. Submit. Wait for results.

**What you'll see:** r ≈ 0.97–0.99, p < 0.001. Temperature explains ice cream sales
just as strongly.

---

### Step 11: Show results and provenance — the full picture (≈2 min)

**What you say:** "Here's what we now know — from three datasets that were never
designed to talk to each other:"

| Analysis | r | p-value | Interpretation |
|----------|---|---------|---------------|
| Crime ↔ Ice cream | ≈ 0.97 | < 0.001 | Spurious — shared cause |
| Crime ↔ Temperature | ≈ 0.97 | < 0.001 | Causal pathway confirmed |
| Ice cream ↔ Temperature | ≈ 0.98 | < 0.001 | Causal pathway confirmed |

> "Ice cream does not cause crime. Crime does not cause ice cream sales.
> **Temperature drives both.** People buy more ice cream in heat. People are
> outside more in heat. Aggression and impulsive behavior increase in heat.
> The mechanism is physiological and sociological — and the data, once you
> bring all three sources together, makes it unambiguous."

**In the UI:**

1. Go to **Analysis results** (or open each completed job).
2. Show the three result rows side by side.
3. Open provenance on any result and say: "Every one of these results points back
   to the exact datasets, versions, and statistical configuration that produced it.
   If a reviewer asks us to reproduce this tomorrow, we run the same job against
   the same provenance chain."

---

## One-line summary for your boss

> "We loaded NYC crime stats, ice cream sales, and temperature data — three sources
> with completely different ID schemes — resolved them all onto the same 12 calendar
> months, and ran cross-dataset correlation analysis. The system surfaced a
> near-perfect ice cream–crime correlation, and then we brought in temperature to
> show it's a textbook confounding variable. Tracefield Lab made it possible to
> discover that connection across three silos, with full reproducibility."

---

## The scientific point (say this if your audience is research-oriented)

This demo illustrates the classic **confounding variable problem**: two variables
(X and Y) appear strongly correlated not because they influence each other, but
because a third variable (Z) is a common cause of both.

```
        Temperature (Z)
       /               \
      ↓                 ↓
Ice cream sales (X)    Crime rate (Y)
```

Tracefield Lab does not (yet) perform formal causal inference (e.g. do-calculus,
instrumental variable analysis, or structural equation modelling). What it *does*
provide is the infrastructure that makes causal hypotheses **testable**: bring
multiple datasets together, resolve shared entities, extract features, and run
the comparative analyses that let a researcher confirm or reject a causal story.

The next step for a real research project would be to add heat as a covariate in a
partial correlation or regression analysis — showing that the ice cream–crime
partial correlation drops toward zero when temperature is held constant.

---

## If something breaks

- **API:** `curl http://localhost:8000/healthz`
- **Logs:** `docker compose logs -f api` or `docker compose logs -f worker-analysis`
- **DB:** See `RUNBOOK.md` for connection and migration commands.
- **Full workflow test:** `./scripts/run-integration-tests.ps1` (or `.sh`)

**Analysis job shows "failed":** The UI shows the failure reason (e.g. *"No overlapping entity-feature data for left and right feature sets"*). For the Heat/Crime demo, that usually means scalar feature values were not loaded — complete **Step 4b** (crime + ice cream) and **Step 8** scalar extract (temperature). Also confirm resolution used join keys **`native_id, canonical_month`** as in Steps 3 and 7; otherwise Phase 1 can “succeed” with meaningless ρ.

---

## Demo data files

| File | Description |
|------|-------------|
| `docs/demo/nyc_crime_2023.csv` | 12 months of NYC crime statistics (NYPD CompStat-style) |
| `docs/demo/nyc_icecream_sales_2023.csv` | 12 months of NYC ice cream vendor sales |
| `docs/demo/nyc_temperature_2023.csv` | 12 months of NYC average temperature (NOAA-style) |

All three use different operational IDs plus a shared **`canonical_month`** so
exact-match resolution fuses the same 12 `time_period` entities across silos.

---

*Last updated to match `ARCHITECTURE.md`, `AGENT.md`, and `RUNBOOK.md`. Uses the
same pipeline steps as the HR/training demo but demonstrates causal reasoning across
three heterogeneous sources rather than two.*
