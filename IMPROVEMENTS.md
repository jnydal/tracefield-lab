Findings
Critical — Password login is advertised in the UI but not implemented in the API
Backend returns 501 for /user/login:
822:824:service/api/src/main/kotlin/com/astroreason/api/Application.kt        post("/user/login") {            call.respond(HttpStatusCode.NotImplemented, mapOf("error" to "Password login not enabled"))        }
Frontend uses password login flow:
46:51:frontend/src/features/auth/pages/login-page.tsx  const onSubmit = async (data: LoginFormData) => {    const result = await login({      identifier: data.identifier,      password: data.password,    }).unwrap();
OpenAPI also declares 501:
513:523:frontend/api-openapi.json    "/user/login": {      "post": {        "operationId": "auth_login",        "responses": {          "501": {            "description": "Not implemented",
Critical — Ingest endpoint + worker pipeline described in docs, but no /ingest route or workers
Docs claim upload via /ingest and worker-ingest parsing:
46:64:RUNBOOK.md### Step 2: Ingest Raw Datacurl -X POST http://localhost:8000/ingest \  -F "datasetId=uuid-here" \  -F "file=@data/example.csv"**What Happens**:1. API stores raw files in object storage2. Enqueues ingest job on Kafka3. Worker-ingest parses data into staging tables
Docs describe worker-ingest, resolver, feature workers, analysis worker:
102:129:ARCHITECTURE.md### 2. Worker-Ingest (`service/worker-ingest`)- Parse raw datasets (CSV/JSON/XML)- Normalize into staging tables- Enqueue feature extraction jobs...### 4. Resolver Service (`service/resolver`)- Resolve entity identity across datasets...### 5. Analysis Worker (Planned)- Compute correlations, regressions, and contingency tests
Docker compose only defines api/db/kafka/minio/grafana; no worker services:
5:133:docker-compose.ymlservices:  api:  db:  kafka:  kafka-ui:  minio:  grafana:  bootstrap:
I also searched for "/ingest" in the Kotlin API source and found no matches.
High — Embeddings storage defined in SQL, but no matching table mappings in Kotlin schema
SQL defines embeddings tables with vector dimensions:
3:57:infra/sql/002_embeddings.sqlCREATE TABLE IF NOT EXISTS embeddings_384 (  person_id UUID NOT NULL REFERENCES person_raw(id) ON DELETE CASCADE,  ...  vector vector(384) NOT NULL,
Tables.kt defines many core tables but no embeddings tables (only vector column type helper), so any ORM access to embeddings is missing:
49:179:service/core/src/main/kotlin/com/astroreason/core/schema/Tables.ktclass VectorColumnType(private val dim: Int) : ColumnType() { ... }...object Datasets : UUIDTable("datasets", ...)object DatasetFiles : UUIDTable("dataset_files", ...)object Entities : UUIDTable("entities", ...)object Features : UUIDTable("features", ...)object AnalysisJobs : UUIDTable("analysis_jobs", ...)object AnalysisResults : UUIDTable("analysis_results", ...)
Medium — Docs describe a full pipeline, but the repo currently behaves like a CRUD system
README describes full pipeline with ingest → workers → analysis:
27:41:README.mdDataset upload      ↓Dataset registry + raw storage      ↓Worker-ingest → staging tables      ↓Entity mapping (resolver)      ↓Feature workers → feature store      ↓Analysis worker → results
This doesn’t align with the current codebase (no ingest endpoint, no workers, analysis worker only “planned”).
Low — Frontend README says the frontend is intentionally domain-agnostic
This makes it less aligned with system-specific docs:
1:4:frontend/README.mdA solid, production-ready React frontend foundation ... intentionally domain-agnostic ...
Overall coherence
The system’s purpose and docs describe a complete ingestion/analysis pipeline, but the implementation is only partially there: API CRUD, OAuth login, database schema for core tables, and frontend pages. The core pipeline workers (ingest/feature/analysis/resolver) and file ingest endpoint are not implemented, so the end‑to‑end flow does not match the docs.
If you want, I can:
Align docs to current reality (mark missing parts as planned / stubbed), or
Implement the missing API endpoints/workers, starting with /ingest and worker-ingest, or
Adjust the frontend to match the currently supported auth flow (remove password login or implement it server‑side).