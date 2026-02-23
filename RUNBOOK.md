# Tracefield Lab Runbook

This document contains operational procedures, troubleshooting, and common tasks.

## Quick Start

### Starting the System

```bash
# Start all services
docker compose up -d --build

# Check service status
docker compose ps

# View logs
docker compose logs -f api
docker compose logs -f worker-ingest
```

### Verify Services

```bash
# API health
curl http://localhost:8000/healthz

# Optional LLM (if running)
curl http://localhost:8001/api/tags
```

## Deployment (Polling Server)

### Build Artifacts (GitHub Actions)

The GitHub Actions workflow publishes a container image to GHCR:

- `ghcr.io/<owner>/<repo>/api:main` (rolling)
- `ghcr.io/<owner>/<repo>/api:<commit-sha>`

It also uploads a `deploy/manifest.json` artifact for auditing.

### Production server setup

Use this flow to run the **production** environment (registry images).

1. **Configure deploy env**: copy `deploy/deploy.env.example` to `deploy/deploy.env` and set your registry images (e.g. `TRACEFIELD_API_IMAGE=ghcr.io/<owner>/<repo>/api:main`).
2. **Log in to GHCR** (use a PAT with `read:packages`):  
   `echo "$GHCR_TOKEN" | docker login ghcr.io -u "<user>" --password-stdin`
3. **Start the production stack**: run `deploy/start.ps1` (Windows) or `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --pull always`.  
   **Image updates**: `deploy/start.ps1` uses `--pull always`, so each run fetches the latest images. Schedule it (e.g. Task Scheduler on Windows, cron on Linux) to get updates automatically.

## Data Pipeline Workflow (Target)

### Step 1: Register Dataset

```bash
curl -X POST http://localhost:8000/datasets \
  -H "Content-Type: application/json" \
  -d '{
    "name": "example-dataset",
    "source": "https://example.org",
    "license": "CC-BY-4.0",
    "schema": {"columns":[{"name":"id","type":"string"}]}
  }'
```

### Step 2: Ingest Raw Data

The UI supports file upload at dataset registration (optional file input in the create form) or via "Upload file" for existing datasets with no files. Alternatively, use the API:

```bash
curl -X POST http://localhost:8000/ingest \
  -F "datasetId=uuid-here" \
  -F "file=@data/example.csv"
```

Returns `{"objectUri":"s3://bucket/key"}`. Files are stored in object storage and inserted into `dataset_files`. The worker-embeddings reads from `dataset_files.object_uri` when processing feature extraction jobs.

**What Happens**:
1. API stores raw files in object storage
2. API inserts record into `dataset_files`
3. (Future) Enqueues ingest job on Kafka; worker-ingest parses data into staging tables
4. For embeddings: worker-embeddings reads raw files from S3 via `dataset_files.object_uri`

### Step 3: Entity Mapping

**Option A: Manual (UI)** — Use the Entity Mappings page: select "Manual" mode, enter dataset ID, entity ID, and method.

**Option B: Manual (API)**:
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

**Option C: Automated semantic resolution** — Use the Entity Mappings page: select "Automated (embeddings)" mode, configure dataset, entity type, join keys, semantic fields, threshold, and records. Or via API:
```bash
curl -X POST http://localhost:8000/resolution/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Resolve dataset",
    "datasetId": "uuid-here",
    "entityType": "person",
    "config": {
      "joinKeys": ["id"],
      "semanticFields": ["name"],
      "threshold": 0.85,
      "createIfNoMatch": false,
      "records": [{"source_record_id": "rec-1", "keys": {"id": "1", "name": "Alice"}}]
    }
  }'
```

The resolver worker polls `resolution_jobs` and writes matches to `entity_map`. Monitor:
```bash
docker compose logs -f resolver
```

### Step 4: Extract Features

**Text-to-embedding** (worker-embeddings): Requires dataset files in object storage and entity mappings.

```bash
curl -X POST http://localhost:8000/features/extract \
  -H "Content-Type: application/json" \
  -d '{
    "datasetId": "<dataset-uuid>",
    "module": "embeddings",
    "inputs": {"textColumn": "description", "idColumn": "id"}
  }'
```

Check job status: `GET /jobs/{jobId}`

Feature workers process jobs from Kafka `features` topic:
- **worker-embeddings**: Reads raw text from object storage, embeds with BGE (1024-dim), writes to `embeddings_1024`
- Other modules write scalar features to `features` table

**Monitor**:
```bash
docker compose logs -f worker-embeddings
docker compose logs -f api
```

### Step 5: Similarity Search

Once embeddings exist, find semantically similar entities:

```bash
curl "http://localhost:8000/entities/{entityId}/similar?limit=10"
```

**If 404 "No embedding found"**: The entity has no embedding in `embeddings_1024`. Run feature extraction with module `embeddings` (Step 4) for the dataset(s) that entity is mapped from. Ensure `EMBEDDINGS_MODEL` matches the model used by worker-embeddings (default `BAAI/bge-large-en-v1.5`).

#### Practical example: "Entities like this one"

**Scenario**: You have two datasets — a product catalog and a support-ticket log. Both are mapped to entities. After extracting embeddings from product descriptions and ticket text, you want to find support tickets semantically similar to a given product (e.g. to discover which issues relate to similar products).

**1. Ensure embeddings exist** for the entities you care about (Step 4):

```bash
curl -X POST http://localhost:8000/features/extract \
  -H "Content-Type: application/json" \
  -d '{
    "datasetId": "<your-dataset-uuid>",
    "module": "embeddings",
    "inputs": {"textColumn": "description", "idColumn": "id"}
  }'
# Wait for job to finish (check GET /jobs/{jobId})
```

**2. Pick an entity ID** (e.g. from Entity Mappings UI or `SELECT entity_id FROM entity_map LIMIT 1`).

**3. Find similar entities**:

```bash
# Top 5 most similar entities
ENTITY_ID="33333333-3333-3333-3333-333333333301"  # e.g. Alice
curl -s "http://localhost:8000/entities/${ENTITY_ID}/similar?limit=5" | jq
```

**Example response**:

```json
{
  "queryEntityId": "33333333-3333-3333-3333-333333333301",
  "model": "BAAI_bge_large_en_v1_5",
  "results": [
    {
      "entityId": "33333333-3333-3333-3333-333333333302",
      "datasetId": "22222222-2222-2222-2222-222222222222",
      "datasetName": "test-survey-2024",
      "sourceRecordId": "rec-002",
      "entityDisplayName": "Bob",
      "similarity": 0.89,
      "rank": 1
    }
  ]
}
```

**4. (Optional) Restrict to specific datasets** — e.g. only show similar entities from the support-ticket dataset:

```bash
curl -s "http://localhost:8000/entities/${ENTITY_ID}/similar?limit=10&datasetIds=22222222-2222-2222-2222-222222222222" | jq
```

**UI**: On the Entity Mappings page, use the "Find similar" button next to any mapping to run the search and view results in a modal.

### Step 6: Run Analysis Jobs

```bash
curl -X POST http://localhost:8000/analysis-jobs \
  -H "Content-Type: application/json" \
  -d '{
    "leftFeatureSet": "traits",
    "rightFeatureSet": "feature_b",
    "test": "spearman",
    "correction": "benjamini-hochberg"
  }'
```

## Database Queries (Target)

### Check Pipeline Progress

```sql
SELECT
  COUNT(*) AS datasets,
  (SELECT COUNT(*) FROM dataset_files) AS files,
  (SELECT COUNT(*) FROM entity_map) AS entity_mappings,
  (SELECT COUNT(*) FROM resolution_jobs) AS resolution_jobs,
  (SELECT COUNT(*) FROM features) AS features,
  (SELECT COUNT(*) FROM analysis_jobs) AS analysis_jobs
FROM datasets;
```

### Check Job Queue Status

```bash
# Kafka topic offsets and consumer lag
docker compose exec kafka /opt/bitnami/kafka/bin/kafka-topics.sh \
  --bootstrap-server localhost:9092 --describe --topic ingest
docker compose exec kafka /opt/bitnami/kafka/bin/kafka-topics.sh \
  --bootstrap-server localhost:9092 --describe --topic features
docker compose exec kafka /opt/bitnami/kafka/bin/kafka-topics.sh \
  --bootstrap-server localhost:9092 --describe --topic analysis
```

## Troubleshooting

### Service Won't Start

```bash
# Check logs
docker compose logs service-name

# Check dependencies
docker compose ps

# Verify database is ready
docker compose exec db pg_isready -U postgres
```

### Jobs Not Processing

**Analysis jobs** (status `queued`) are processed by `worker-analysis`, which polls the DB every few seconds. **Resolution jobs** are processed by `resolver`. Ensure they are running:

```bash
docker compose ps worker-analysis
docker compose logs -f worker-analysis

docker compose ps resolver
docker compose logs -f resolver
```

**Ingest/feature jobs** (Kafka-based):

```bash
# Check Kafka connection
docker compose exec kafka /opt/bitnami/kafka/bin/kafka-topics.sh \
  --bootstrap-server localhost:9092 --list

# Check worker logs
docker compose logs -f worker-ingest
```

### Database Connection Issues

```bash
# Test connection
docker compose exec api java -jar app.jar
# Or check environment variables
docker compose exec api env | grep PG_DSN
```

### Schema Inference

Schema inference (`POST /schema/infer`) infers column types and mapping suggestions from pasted CSV/JSON samples. It always uses heuristic inference (no LLM required). To enable LLM-enhanced inference, set `OLLAMA_URL` or `LLM_URL` (e.g. `http://local-llm:11434`) in the API environment. See AGENT.md for curl examples.

### LLM Not Responding

```bash
# Check Ollama
curl http://localhost:8001/api/tags

# Pull model if needed
docker compose exec local-llm ollama pull qwen2.5:7b-instruct-q4_K_M
```

### Windows / Production Deployment

**PowerShell "NativeCommandError" in logs**: Docker writes progress (Pulling, Running) to stderr. `deploy/start.ps1` uses `cmd /c` to avoid this; ensure you have the latest script.

**API shows "unhealthy"**: Ensure the API image includes `curl` for the healthcheck. The Dockerfile installs it; rebuild and push the API image if you see persistent unhealthy status.

**Getting latest images**: `deploy/start.ps1` uses `--pull always`. Run it via Task Scheduler (e.g. at boot or on a schedule) to always start with the latest registry images.

## Development Workflow

### Building Services

```bash
# Build all Kotlin services
./gradlew build

# Build specific service
./gradlew :service:api:build

# Run tests
./gradlew test
```

### Local Development

```bash
# Run API locally (requires DB/Kafka running)
cd service/api
./gradlew run

# Run worker locally
cd service/worker-ingest
./gradlew run
```

### Debugging

```bash
# Attach debugger to Kotlin service
# Add to docker-compose.yml:
#   environment:
#     JAVA_OPTS: "-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:5005"

# View service logs in real-time
docker compose logs -f --tail=100 service-name

# Execute commands in container
docker compose exec service-name /bin/sh
```

## API Client Examples (Target)

### Python Client

```python
import requests

# Upload dataset file
with open("data.csv", "rb") as f:
    response = requests.post(
        "http://localhost:8000/ingest",
        files={"file": f},
        data={"datasetId": "uuid-here"}
    )
    job = response.json()
    print(f"Job ID: {job['jobId']}")

# Check status
job_id = job['jobId']
status = requests.get(f"http://localhost:8000/jobs/{job_id}").json()
print(f"Status: {status['status']}")
```

### Kotlin Client

```kotlin
import io.ktor.client.*
import io.ktor.client.engine.cio.*
import io.ktor.client.request.*
import io.ktor.http.*

val client = HttpClient(CIO)

// Upload dataset file
val response = client.post("http://localhost:8000/ingest") {
    setBody(MultiPartFormDataContent(
        formData {
            append("datasetId", "uuid-here")
            append("file", File("data.csv").readBytes(), Headers.build {
                append(HttpHeaders.ContentType, "text/csv")
            })
        }
    ))
}
```

## Monitoring & Health Checks

### Service Health

All services expose health endpoints:
- API: `GET http://localhost:8000/healthz`

### Database Health

```sql
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Queue Monitoring

```bash
# Watch topic status (sample)
watch -n 5 'docker compose exec kafka /opt/bitnami/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --describe --topic ingest'
```

## Common Tasks

### Load Test Data (thor.nydal@uptimeconsulting.no)

To populate test data so you can run a job:

```bash
docker compose exec -T db psql -U postgres -d tracefield < infra/sql/099_seed_test_data.sql
```

This creates: user, dataset `test-survey-2024`, 3 entities (Alice, Bob, Carol), entity mappings, 2 feature definitions, 6 feature values, and 1 analysis job. Safe to re-run (idempotent).

### Reset Pipeline for New Dataset

```sql
-- Clear all data (CAUTION: destructive)
TRUNCATE datasets CASCADE;
```

### Reprocess Failed Jobs

Jobs are stored in PostgreSQL (`job_status`). Check failed job IDs and re-enqueue to Kafka if needed.
