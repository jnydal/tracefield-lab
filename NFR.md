# Non-Functional Requirements: Research Lab

This document describes non-functional requirements for the generic research lab system.

## Goals

- Provide end-to-end visibility into ingestion, feature extraction, and analysis.
- Enable reproducible, statistically sound research workflows.
- Support rapid diagnosis and recovery from failures.
- Scale to multiple datasets and analysis workloads.

## Reliability & Resilience

- **Idempotency:** All pipeline stages should safely reprocess the same input without corrupting state.
- **Retries:** External calls use bounded retries with backoff.
- **Failure handling:** Jobs surface clear failure reasons and can be re-enqueued safely.
- **Data integrity:** Writes must be transactional where possible; partial writes detectable.
- **Queue safety:** Workers tolerate duplicate or out-of-order jobs.

## Performance & Scalability

- **Throughput:** Backlogs drain within 24 hours under typical workloads.
- **Batching:** Use batched inserts and vector writes to reduce DB overhead.
- **Horizontal scaling:** Workers scale by adding instances per queue/topic.
- **Resource caps:** Services run within container limits and degrade gracefully.

## Security

- **AuthN/Z:** API endpoints require authentication in production.
- **Secrets:** Credentials managed via environment variables or secret store.
- **Network:** Internal services isolated from public access; only API exposed.
- **Data access:** Database roles follow least privilege.

## Data Governance

- **Provenance:** Pipeline actions recorded in `provenance_event`.
- **Retention:** Raw data and derived features have defined retention policies.
- **PII:** Personal data minimized; redaction in logs and exports.
- **Licensing:** Dataset licenses stored and enforced downstream.

## Reproducibility & Scientific Validity

- **Config versioning:** Analysis jobs store full config, code version, and inputs.
- **Statistical rigor:** Support multiple-testing correction and effect sizes.
- **Confounders:** Allow covariates and stratification in analysis.
- **Data quality:** Flag missingness, outliers, and low-variance features.

## Availability & Recovery

- **Backups:** PostgreSQL backups at least daily with restore verification.
- **RPO/RTO:** Define recovery point/time objectives per environment.
- **Graceful degradation:** When dependencies fail, pipeline pauses and resumes without data loss.

## Compliance & External Dependencies

- **Terms of use:** Respect upstream API usage and rate limits.
- **Attribution:** Preserve required attribution in downstream use.

## Observability Signals

### Metrics

- **Pipeline throughput:** items processed per stage per time unit.
- **Latency:** end-to-end and per-stage processing time (p50/p95/p99).
- **Queue health:** backlog depth, oldest item age, retry counts.
- **Error rate:** failures by stage, reason, and dependency.
- **Resource usage:** CPU, memory, disk, and network per service.

### Logs

- Structured logs with fields: `service`, `stage`, `job_id`, `trace_id`, `status`,
  `duration_ms`, `dataset_id`, `entity_type`.
- Errors include stack traces and root-cause context.
- Sensitive data redacted or excluded.

### Traces

- Correlate requests/jobs across services using a shared `trace_id`.
- Capture spans for queue enqueue/dequeue, database calls, external APIs.

## Dashboards

- **Pipeline overview:** throughput, latency, error rate, queue depth.
- **Service health:** resource usage and error spikes by service.
- **Dependency health:** database and external API response times.

## Alerts

- **Critical:** sustained pipeline outage, queue backlog growth without recovery,
  database connectivity errors, repeated job failures.
- **Warning:** elevated latency, error rate above baseline, or resource saturation.
- Alerts include actionable context (service, stage, time window, links).

## Data Retention

- Metrics retained for at least 30 days.
- Logs retained for at least 14 days.
- Traces retained for at least 7 days.

## Responsibilities

- Service owners ensure instrumentation in new code paths.
- Operations owns dashboard and alert maintenance.
