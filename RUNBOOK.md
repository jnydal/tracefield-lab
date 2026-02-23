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

Use this flow to run the **production** environment (registry images + Watchtower for updates).

1. **Configure deploy env**: copy `deploy/deploy.env.example` to `deploy/deploy.env` and set your registry images (e.g. `TRACEFIELD_API_IMAGE=ghcr.io/<owner>/<repo>/api:main`).
2. **Log in to GHCR** (use a PAT with `read:packages`):  
   `echo "$GHCR_TOKEN" | docker login ghcr.io -u "<user>" --password-stdin`
3. **Start the production stack**: run `deploy/start.ps1` (Windows) or `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d`.  
   **Watchtower** (in the base compose) periodically pulls new images from the registry and restarts updated containers; no separate polling script or cron is required.

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

```bash
curl -X POST http://localhost:8000/ingest \
  -F "datasetId=uuid-here" \
  -F "file=@data/example.csv"

# Get job ID from response
JOB_ID="..."

# Monitor job
watch -n 2 "curl -s http://localhost:8000/jobs/$JOB_ID | jq .status"
```

**What Happens**:
1. API stores raw files in object storage
2. Enqueues ingest job on Kafka
3. Worker-ingest parses data into staging tables
4. Downstream feature jobs are enqueued

### Step 3: Configure Entity Mapping (Optional)

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

### Step 4: Extract Features

Feature workers process jobs automatically:
- Embeddings or custom modules
- Write standardized features with provenance

**Monitor**:
```bash
docker compose logs -f embeddings
docker compose logs -f traits
docker compose logs -f api
```

### Step 5: Run Analysis Jobs

```bash
curl -X POST http://localhost:8000/analysis/jobs \
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

### LLM Not Responding

```bash
# Check Ollama
curl http://localhost:8001/api/tags

# Pull model if needed
docker compose exec local-llm ollama pull qwen2.5:7b-instruct-q4_K_M
```

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
