# Tracefield Lab

Tracefield Lab is a modular pipeline for multi-dataset analysis. It abstracts ingestion,
entity mapping, feature extraction, and statistical analysis into configurable modules,
so researchers can compare heterogeneous datasets without rewriting the pipeline.

**Demo / MVP:** [https://tracefieldlab.thor-nydal.no](https://tracefieldlab.thor-nydal.no)

---

## Abstract

Many research workflows require combining datasets, harmonizing entities, extracting
features, and running statistical tests. Tracefield Lab provides a reproducible system
for that workflow, with a feature store, analysis jobs, and provenance tracking.

The system:

1. Registers datasets with schemas and licensing metadata (schema can be inferred from CSV/JSON samples).
2. Ingests raw data into staging tables and object storage.
3. Maps entities across datasets using manual mapping or automated semantic resolution (exact keys + BGE embeddings).
4. Extracts features via modular workers: **text-to-embedding** (BGE 1024-dim) and domain-specific scalar features.
5. Runs statistical analysis with effect sizes and correction.

### What makes it different

Most research tools work within a single dataset or domain. Tracefield Lab is built for
**correlation discovery across heterogeneous sources**—different labs, disciplines, and
formats that rarely get compared. Entity resolution (exact keys plus semantic matching
with embeddings) lets you map "the same thing" across datasets. The feature store and
analysis layer then surface correlations that emerge only when you can cross-reference.
That makes it a tool for cracking open hermeticized science: bringing siloed knowledge
into one auditable, reproducible system so you can find the patterns that live at the
boundaries.

---

## Where this is heading

The current system already handles the hard part: fusing heterogeneous datasets via
embedding-based entity resolution and running reproducible statistical analysis with a
full provenance chain. What is being built next changes the character of the tool.

**From confirmatory to exploratory.** Today a researcher brings a hypothesis — two
datasets, a suspected connection — and Tracefield confirms or disconfirms it. The next
step is a **discovery scan**: select a pool of datasets, and let the system run all
pairwise correlations across every resolved feature, rank by strength, apply global
multiple-testing correction, and surface candidate confounders automatically. Instead
of asking "is X connected to Y?", you ask "what is connected to what — and what is
driving it?" That is a different kind of research instrument.

**The confounding variable problem, solved systematically.** Finding that ice cream
sales and crime rates correlate is easy. Understanding that temperature drives both —
without already knowing to look for it — requires comparing a third dataset against
both. A discovery scan does that exhaustively across an entire feature pool, flagging
triangular correlation patterns and computing partial correlations to quantify how much
each candidate confounder explains. The researcher still interprets; the system finds
what is worth interpreting.

**A guided pipeline, not a command-line workflow.** Cross-silo research should not
require reading a 500-line walkthrough document before running a first analysis. An
upcoming pipeline wizard will make the five-stage sequence — datasets, entity mapping,
feature extraction, analysis, results — navigable by any researcher without prior
knowledge of the system internals.

**The long-term ambition** is for Tracefield Lab to become standard infrastructure for
observational research that crosses dataset boundaries: the tool researchers reach for
when they have data from different labs, registries, surveys, or archives that were
never designed to be compared, and need to cross-reference them rigorously and
reproducibly. Not a replacement for domain expertise or formal causal inference — a
foundation that makes the cross-silo hypothesis-testing work tractable and auditable.

---

## Technical Overview

### Data Flow (Target)

```
Dataset upload
      ↓
Dataset registry + raw storage
      ↓
Worker-ingest → staging tables
      ↓
Entity mapping (resolver)
      ↓
Feature workers → feature store
      ↓
Analysis worker → results
```

### System Components

| Component | Description |
|----------|-------------|
| API (Kotlin/Ktor) | Dataset registry, job orchestration, results |
| Worker-ingest | Parses datasets and normalizes raw data |
| Resolver | Semantic entity resolution (BGE embeddings, exact + fuzzy matching) |
| Feature workers | Embeddings, custom modules |
| Analysis worker | Statistical tests and corrections |
| PostgreSQL + pgvector | Structured data and vector storage |
| Kafka | Job queue |
| MinIO | Raw dataset object storage |
| Grafana (optional) | Metrics |

---

## AI-assisted development

**Claude Code** and other agents: start with [CLAUDE.md](CLAUDE.md) for read order, non-negotiables, and how this repo’s testing philosophy relates to strict TDD workflows (e.g. [Superpowers](https://github.com/obra/superpowers)). API and workflow examples live in [AGENT.md](AGENT.md).

## Invariants and Guardrails

Core pipeline assumptions (provenance, job status lifecycle, feature contract) are documented in [docs/INVARIANTS.md](docs/INVARIANTS.md) and checked in CI. A full-workflow integration test (`test/test_full_workflow_integration.py`) validates the path from seed data to analysis results and provenance. **CI** runs unit tests (excluding `@pytest.mark.integration`) then integration tests against a real Postgres; see [RUNBOOK](RUNBOOK.md) for local test commands.

## Feature Modules

Feature modules follow a common contract and write to the feature store with provenance.
Examples:

- Text embeddings (semantic vectors)
- Structured trait extraction
- Domain-specific numeric features
- Entity attribute normalization

---

## Database Schema (Target Core Tables)

- `datasets` — metadata, schema, source, license
- `dataset_files` — object storage references
- `entities` — canonical entities and types
- `entity_map` — cross-dataset mapping rules (manual or from resolution jobs)
- `resolution_jobs` — entity resolution job queue and status
- `features` — normalized feature values with provenance
- `analysis_jobs` — analysis configurations and status
- `analysis_results` — tests, effect sizes, p-values
- `provenance_event` — process audit tracking

---

## Installation & Local Setup

### Requirements
- Docker + Docker Compose
- ~12 GB disk space
- CPU-only support (Gpu optional for faster inference)

### Start services

**Dev** (API built locally):

```bash
docker compose up -d --build
```

**Production** (API and services from registry; Watchtower pulls new images from CI and restarts containers). Use the prod override and start via `deploy/start.ps1` or docker compose:

```bash
# One-time: copy and edit deploy/deploy.env (see deploy/deploy.env.example)
# Start production stack (start.ps1; api, frontend, workers, resolver use pull_policy: always; schedule it for automatic updates).
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

Ensure `TRACEFIELD_API_IMAGE` (and other image vars) are set in `deploy/deploy.env` or `.env`, e.g. `ghcr.io/<owner>/<repo>/api:main`. See [RUNBOOK.md](RUNBOOK.md) production deployment section.

The web frontend follows the system light/dark preference. Users with a dark OS theme see an inverted (dark) theme. You can override it by setting `localStorage.setItem('color-theme', 'light')` or `'dark'` in the browser.

### Kafka topics (required)

The pipeline expects `ingest`, `features`, and `analysis` topics (adjust per config):

```bash
docker compose exec -T kafka rpk topic create ingest
docker compose exec -T kafka rpk topic create features
docker compose exec -T kafka rpk topic create analysis
```

Verify:

```bash
docker compose ps
```

### Load the LLM (optional)

```bash
docker exec -it <local-llm-container-name> ollama pull qwen2.5:7b-instruct-q4_K_M
```

Test:

```bash
curl http://localhost:8001/api/tags
```

---

## Typical Usage Flow

1. Register a dataset (optionally infer schema from a pasted CSV/JSON sample)
2. Upload raw data
3. Map entities (manual via Entity Mappings UI, or automated via resolution jobs with embeddings)
4. Trigger feature extraction
5. Run analysis jobs and inspect results

Each processing step logs a provenance record for reproducibility.

---

## Observability

Grafana dashboards are provisioned from `grafana/` when you run
`docker compose up`. The default Grafana login is `admin` / `admin` and the
PostgreSQL datasource points at the local `db` container.

Dashboards:
- `Pipeline Observability` provides counts for datasets, features, and jobs.

Alerts:
- `Pipeline stuck` triggers when any record has not progressed within the SLA.
- `Pipeline errors` triggers when error events appear in the last 15 minutes.

---

## License

For research use only. External datasets must follow their respective licenses.

---

## Citation

If using Tracefield Lab for academic research, cite:
- Model name and version (if LLMs used)
- Prompt hash (if LLMs used)
- Processing date
- Dataset source attribution
