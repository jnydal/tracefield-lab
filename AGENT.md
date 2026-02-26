# Tracefield Lab Agent Guide

This document describes how to interact with the Tracefield Lab system at a high level.
Operational commands, troubleshooting, and step-by-step procedures live in `RUNBOOK.md`.

## Interaction Patterns (Proposed)

The web UI (frontend) supports light and dark themes driven by system preference (`prefers-color-scheme`); an optional override is stored in `localStorage` under `color-theme` (`'light'` or `'dark'`). See RUNBOOK for deployment notes.

### 1. API Service (Port 8000)

**Infer schema from sample** (proposes column types and mapping suggestions):
```bash
curl -X POST http://localhost:8000/schema/infer \
  -H "Content-Type: application/json" \
  -d '{
    "sampleContent": "id,name,description\n1,Alice,Researcher\n2,Bob,Engineer",
    "format": "csv"
  }'
```
Returns `{"columns":[{"name":"id","type":"string"},...],"suggestions":{"textColumn":"description","idColumn":"id","joinKeys":["id"],"semanticFields":["name"]}}`. Uses heuristic inference always; enhances with LLM when `OLLAMA_URL` or `LLM_URL` is set.

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
Returns `{"objectUri":"s3://bucket/key"}`. The UI supports file upload when creating a dataset or via "Upload file" for datasets with no files. Files are stored in object storage and registered in `dataset_files` for worker-embeddings.

**Create Entity Mapping (manual, one mapping)**:
```bash
curl -X POST http://localhost:8000/entity-mappings \
  -H "Content-Type: application/json" \
  -d '{
    "datasetId": "uuid-here",
    "entityId": "entity-uuid-here",
    "sourceRecordId": "rec-001",
    "method": "exact"
  }'
```

**Create Resolution Job (automated, semantic matching with embeddings)**:
```bash
curl -X POST http://localhost:8000/resolution/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Resolve survey 2024",
    "datasetId": "uuid-here",
    "entityType": "person",
    "config": {
      "joinKeys": ["id"],
      "semanticFields": ["name"],
      "threshold": 0.85,
      "createIfNoMatch": false,
      "records": [{"source_record_id": "rec-1", "keys": {"id": "1", "name": "John Smith"}}]
    }
  }'
```

The resolver worker polls `resolution_jobs` and writes matches to `entity_map`. Use the Entity Mappings UI for manual mapping or automated resolution (toggle between modes).

**Trigger Feature Extraction** (text-to-embedding):
```bash
curl -X POST http://localhost:8000/features/extract \
  -H "Content-Type: application/json" \
  -d '{
    "datasetId": "uuid-here",
    "module": "embeddings",
    "inputs": {
      "textColumn": "description",
      "idColumn": "id"
    }
  }'
```
Check job status: `GET /jobs/{jobId}`

**Run Analysis Job** (embedding component vs scalar):
```bash
curl -X POST http://localhost:8000/analysis-jobs \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Embedding dim 0 vs score",
    "config": {
      "leftFeatureSet": "embeddings.bge_large",
      "leftDimension": 0,
      "rightFeatureSet": "score",
      "test": "spearman",
      "correction": "benjamini-hochberg"
    }
  }'
```

**Run Analysis Job** (embedding clustering):
```bash
curl -X POST http://localhost:8000/analysis-jobs \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Clusters vs outcome",
    "config": {
      "test": "embedding_clustering",
      "embeddingDef": "embeddings.bge_large",
      "nClusters": 3,
      "outcomeFeature": "score",
      "correction": "benjamini-hochberg"
    }
  }'
```

**Check Analysis Job Status**:
```bash
curl http://localhost:8000/analysis-jobs/{jobId}
```

**Check Resolution Job Status**:
```bash
curl http://localhost:8000/resolution/jobs/{jobId}
```

**Similarity Search** (find entities semantically similar to a given entity):
```bash
curl "http://localhost:8000/entities/{entityId}/similar?limit=10"
# Optional: filter by datasets
curl "http://localhost:8000/entities/{entityId}/similar?limit=10&datasetIds=uuid1,uuid2"
```

### 2. Worker Services

Workers run continuously:

- **worker-ingest**: Parses datasets from object storage (Kafka)
- **resolver**: Polls `resolution_jobs`, runs semantic entity resolution (BGE embeddings + exact match), writes to `entity_map`
- **feature workers**: Compute features (embeddings, custom modules) via Kafka
- **analysis worker**: Polls `analysis_jobs`, runs statistical tests and stores results

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

Add new routes in `service/api/src/main/kotlin/com/tracefield/api/Application.kt`:

```kotlin
get("/new-endpoint") {
    call.respond(mapOf("status" to "ok"))
}
```

### Adding Database Tables

1. Define table in `service/core/src/main/kotlin/com/tracefield/core/schema/Tables.kt`
2. Create migration SQL in `infra/sql/`
3. Update Exposed table definitions
