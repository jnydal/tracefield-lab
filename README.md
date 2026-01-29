# Research Lab

Research Lab is a modular pipeline for multi-dataset analysis. It abstracts ingestion,
entity mapping, feature extraction, and statistical analysis into configurable modules,
so researchers can compare heterogeneous datasets without rewriting the pipeline.

---

## Abstract

Many research workflows require combining datasets, harmonizing entities, extracting
features, and running statistical tests. Research Lab provides a reproducible system
for that workflow, with a feature store, analysis jobs, and provenance tracking.

The system:

1. Registers datasets with schemas and licensing metadata.
2. Ingests raw data into staging tables and object storage.
3. Maps entities across datasets using deterministic or fuzzy matching.
4. Extracts features via modular workers (embeddings, traits, domain-specific).
5. Runs statistical analysis with effect sizes and correction.

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
| Feature workers | Embeddings, traits, astro, custom modules |
| Analysis worker | Statistical tests and corrections (planned) |
| PostgreSQL + pgvector | Structured data and vector storage |
| Kafka | Job queue |
| MinIO | Raw dataset object storage |
| Grafana (optional) | Metrics |

---

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
- `entity_map` — cross-dataset mapping rules
- `features` — normalized feature values with provenance
- `analysis_jobs` — analysis configurations and status
- `analysis_results` — tests, effect sizes, p-values
- `provenance_event` — process audit tracking

---

## Installation & Local Setup

### Requirements
- Docker + Docker Compose
- ~12 GB disk space
- CPU-only support (GPU optional for faster inference)

### Start services

```bash
docker compose up -d --build
```

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

1. Register a dataset (name, schema, license)
2. Upload raw data
3. Configure entity mapping (keys or fuzzy rules)
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

If using Research Lab for academic research, cite:
- Model name and version (if LLMs used)
- Prompt hash (if LLMs used)
- Processing date
- Dataset source attribution
