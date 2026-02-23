# Tracefield Lab Architecture

## Overview

The Tracefield Lab is a generic, modular data pipeline for multi-dataset analysis. It abstracts data ingestion, entity mapping, feature extraction, and statistical analysis into configurable modules, allowing researchers to compare heterogeneous datasets without rewriting the pipeline for each domain.

## System Architecture

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ HTTP
       ↓
┌─────────────────────────────────────────────────────────────┐
│                    API Service (Kotlin)                      │
│  - Dataset registry                                           │
│  - Uploads / ingest requests                                  │
│  - Entity mapping rules                                       │
│  - Feature extraction jobs                                    │
│  - Analysis job orchestration                                 │
└──────┬──────────────────────────────────────────────────────┘
       │
       ├─→ Kafka Topics (ingest / features / analysis)
       │         ↓
       │   ┌─────────────────────┐
       │   │ Worker-Ingest       │
       │   │ (Kotlin)            │
       │   └─────────────────────┘
       │
       └─→ Object Storage (MinIO/S3)
                 │
                 └─→ Stores raw datasets

┌─────────────────────────────────────────────────────────────┐
│                    Research Pipeline                          │
└─────────────────────────────────────────────────────────────┘

1. Ingest Worker
   ├─→ Parses data → PostgreSQL (raw tables, dataset metadata)
   └─→ Enqueues feature extraction jobs

2. Feature Workers (Python/Kotlin)
  ├─→ Embeddings / domain modules
   ├─→ Produce feature vectors
   └─→ Write → PostgreSQL (features table)

3. Entity Resolver
   ├─→ Polls resolution_jobs (queued)
   ├─→ Exact match (join keys) + semantic match (BGE embeddings)
   └─→ Writes → PostgreSQL (entity_map)

4. Analysis Worker
   ├─→ Pulls feature pairs
   ├─→ Runs statistical tests
   └─→ Writes → PostgreSQL (analysis_results)
```

## Core Concepts

- **Dataset Registry**: Stores metadata, schema, source, license, refresh cadence.
- **Entity Model**: Canonical entity types with cross-dataset mapping.
- **Feature Store**: Normalized features with provenance for reproducibility.
- **Analysis Jobs**: Configurable statistical tests over feature sets.
- **Provenance**: Full pipeline audit trail (inputs, config, module versions).

## Technology Stack

### Kotlin Services
- **Framework**: Ktor 2.3.7
- **Database**: Exposed ORM 0.49.0
- **Connection Pooling**: HikariCP 5.1.0
- **Serialization**: Kotlinx Serialization 1.6.2
- **HTTP Client**: Ktor Client
- **AWS SDK**: AWS SDK for Kotlin (S3)
- **Kafka**: Spring Kafka

### Python Services
- **Framework**: FastAPI (optional), Kafka consumers (feature workers)
- **ML**: sentence-transformers, custom models
- **Database**: psycopg2

### Infrastructure
- **Database**: PostgreSQL 16 with pgvector extension
- **Queue**: Kafka (KRaft, single-node)
- **Object Storage**: MinIO
- **LLM**: Ollama (local LLM runtime)
- **Monitoring**: Grafana (optional)

## Service Details

### 1. API Service (`service/api`)

**Responsibilities**:
- Dataset registration and schema management
- Ingest job submission and status
- Entity mapping configuration
- Feature extraction job orchestration
- Analysis job submission and result access

**Dependencies**: Database, Kafka, Object Storage

### 2. Worker-Ingest (`service/worker-ingest`)

**Responsibilities**:
- Parse raw datasets (CSV/JSON/XML)
- Normalize into staging tables
- Enqueue feature extraction jobs

### 3. Feature Workers (Custom Modules)

**Responsibilities**:
- Transform data into standardized features
- Write to feature store with provenance
- Publish completion and job status

These services become modular feature providers in the generic system.

### 4. Resolver Service (`service/resolver`)

**Responsibilities**:
- Poll `resolution_jobs` for queued jobs (DB polling, same pattern as analysis worker)
- Resolve entity identity: exact match (join keys) and semantic match (BGE embeddings)
- Create entities if `createIfNoMatch` is enabled
- Emit provenance events

**Trigger**: API creates job via `POST /resolution/jobs`; resolver picks it up. No Kafka.

### 5. Analysis Worker (`service/worker_analysis`)

**Responsibilities**:
- Compute correlations, regressions, and contingency tests
- Apply multiple-testing correction
- Store results with effect sizes and confidence intervals

## Data Flow

```
1. Register dataset
   Client → API → PostgreSQL (dataset registry)

2. Upload raw data
   Client → API → Object Storage

3. Parse & ingest
   API → Kafka → Worker-Ingest → PostgreSQL (raw/staging)

4. Map entities
   API → resolution_jobs (queued) → Resolver polls → PostgreSQL (entity_map)
   Or: API → entity-mappings (manual, direct write to entity_map)

5. Extract features
   Kafka → Feature Workers → PostgreSQL (features)

6. Analyze
   Kafka → Analysis Worker → PostgreSQL (analysis_results)
```

## Database Schema (Target)

**Core Tables**:
- `datasets` - Metadata, schema, source, license
- `dataset_files` - Object storage references
- `entities` - Canonical entities and types
- `entity_map` - Cross-dataset mapping rules (manual or from resolution jobs)
- `resolution_jobs` - Entity resolution job queue (status, config, result_summary)
- `features` - `entity_id`, `feature_name`, `value`, `type`, `provenance`
- `analysis_jobs` - Job config and status
- `analysis_results` - Tests, effect sizes, p-values, corrections
- `provenance_event` - Audit tracking

## Communication Patterns

### Synchronous (HTTP)
- Client ↔ API
- API ↔ Resolver (optional)
- Feature Workers ↔ LLM (optional)

### Asynchronous (Kafka Topics)
- API → Worker-Ingest
- Worker-Ingest → Feature Workers
- API → Analysis Worker

### Database (PostgreSQL)
- All services read/write shared database
- Connection pooling via HikariCP
- Exposed ORM for type-safe queries

## Deployment

### Containerization
- All services containerized with Docker
- Multi-stage builds for Kotlin services
- Python services use slim base images

### Orchestration
- Docker Compose for local development
- Health checks for all services
- Dependency management (`depends_on`)

### Environment Variables
- `PG_DSN` / `DATABASE_URL` - PostgreSQL connection
- `KAFKA_BOOTSTRAP_SERVERS` - Kafka connection
- `OBJECT_STORE_*` - Object storage configuration
- `LLM_URL` - LLM service URL
- `LLM_MODEL` - Model name for feature modules
- `EMBEDDINGS_MODEL` - BGE model for resolver (e.g. BAAI/bge-small-en-v1.5)

## Scalability Considerations

### Horizontal Scaling
- **API**: Stateless, can scale horizontally
- **Workers**: Multiple instances per queue/topic
- **Database**: Single instance (can be replicated)

### Queue Management
- Kafka-based job queues
- Consumer groups for feature modules
- Job status tracking in PostgreSQL (`job_status`)

## Security Considerations

- Credentials via environment variables or secret store
- No public exposure of internal services
- API auth required for production
- Network isolation via Docker networks

## Monitoring & Observability

- Health check endpoints on all services
- Grafana for metrics (optional)
- Provenance events for audit trail
- Structured logging (SLF4J/Logback)

## Future Enhancements

1. **Analysis Worker**: full statistical suite with corrections
2. **UI**: dataset configuration + analysis builder
3. **Plugin Registry**: discoverable feature modules
4. **OpenTelemetry**: distributed tracing
