# Tracefield Lab Agent Guide

This document describes how to interact with the Tracefield Lab system at a high level.
Operational commands, troubleshooting, and step-by-step procedures live in `RUNBOOK.md`.

## Interaction Patterns (Proposed)

### 1. API Service (Port 8000)

**Register a Dataset**:
```bash
curl -X POST http://localhost:8000/datasets \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Example Dataset",
    "source": "https://example.org",
    "license": "CC-BY-4.0",
    "schema": {"columns": [{"name": "id", "type": "string"}]}
  }'
```

**Upload Raw Data**:
```bash
curl -X POST http://localhost:8000/ingest \
  -F "datasetId=uuid-here" \
  -F "file=@data/example.csv"
```

**Create Entity Mapping Rules**:
```bash
curl -X POST http://localhost:8000/entities/map \
  -H "Content-Type: application/json" \
  -d '{
    "datasetId": "uuid-here",
    "entityType": "person",
    "joinKeys": ["id", "name"],
    "fuzzyMatch": {"field": "name", "threshold": 0.92}
  }'
```

**Trigger Feature Extraction**:
```bash
curl -X POST http://localhost:8000/features/extract \
  -H "Content-Type: application/json" \
  -d '{
    "datasetId": "uuid-here",
    "module": "embeddings",
    "inputs": {"textColumn": "bio_text"}
  }'
```

**Run Analysis Job**:
```bash
curl -X POST http://localhost:8000/analysis/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "leftFeatureSet": "traits",
    "rightFeatureSet": "astro",
    "test": "spearman",
    "correction": "benjamini-hochberg"
  }'
```

**Check Job Status**:
```bash
curl http://localhost:8000/jobs/{jobId}
```

### 2. Worker Services

Workers run continuously and process jobs from Kafka topics:

- **worker-ingest**: Parses datasets from object storage
- **feature workers**: Compute features (embeddings, traits, astro, custom modules)
- **analysis worker**: Runs statistical tests and stores results
- **resolver**: Optional entity resolver (e.g., QID lookups)

## Service Configuration

### Environment Variables

Create `.env` file:

```bash
# Database
DATABASE_URL=postgresql://postgres:postgres@db:5432/research_lab
PG_DSN=postgresql://postgres:postgres@db:5432/research_lab

# Kafka
KAFKA_BOOTSTRAP_SERVERS=kafka:9092

# Object storage
OBJECT_STORE_ENDPOINT=http://minio:9000
OBJECT_STORE_ACCESS_KEY=minio
OBJECT_STORE_SECRET_KEY=minio123
OBJECT_STORE_BUCKET_RAW=research-raw

# LLM (optional, used by some feature modules)
LLM_URL=http://local-llm:11434
LLM_MODEL=qwen2.5:7b-instruct-q4_K_M

# Embeddings (optional)
EMBEDDINGS_MODEL=BAAI/bge-large-en-v1.5
```

## Module Contract (Feature Providers)

All feature modules implement the same contract:

- **Inputs**: dataset id, entity type, column mapping
- **Outputs**: `features` records with `entity_id`, `feature_name`, `value`, `type`
- **Provenance**: module name, version, config hash, source dataset

Example output:
```json
{
  "entityId": "uuid-here",
  "featureName": "trait.openness",
  "value": 0.84,
  "type": "float",
  "provenance": {"module": "traits", "version": "1.2.0"}
}
```

## Integration Points

### Adding a New Feature Module

1. Create service directory in `service/`
2. Implement module contract in worker code
3. Add Dockerfile and dependencies
4. Register module in API configuration
5. Add to `docker-compose.yml`

### Extending the API

Add new routes in `service/api/src/main/kotlin/com/astroreason/api/Application.kt`:

```kotlin
get("/new-endpoint") {
    call.respond(mapOf("status" to "ok"))
}
```

### Adding Database Tables

1. Define table in `service/core/src/main/kotlin/com/astroreason/core/schema/Tables.kt`
2. Create migration SQL in `infra/sql/`
3. Update Exposed table definitions
