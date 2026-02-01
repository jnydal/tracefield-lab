-- Observability views for Grafana dashboards (generic pipeline)

CREATE OR REPLACE VIEW pipeline_counts AS
SELECT
  (SELECT COUNT(*) FROM datasets) AS datasets_total,
  (SELECT COUNT(*) FROM entities) AS entities_total,
  (SELECT COUNT(*) FROM features) AS features_total,
  (SELECT COUNT(*) FROM analysis_jobs) AS analysis_jobs_total,
  (SELECT COUNT(*) FROM analysis_results) AS analysis_results_total;

CREATE OR REPLACE VIEW pipeline_stage_daily AS
SELECT
  date_trunc('day', created_at) AS day,
  stage,
  COALESCE(detail->>'status', 'unknown') AS status,
  COUNT(*) AS events
FROM provenance_event
GROUP BY 1, 2, 3;

CREATE OR REPLACE VIEW pipeline_latest_event AS
SELECT
  dataset_id,
  MAX(created_at) AS last_event_at
FROM provenance_event
WHERE dataset_id IS NOT NULL
GROUP BY dataset_id;

CREATE OR REPLACE VIEW pipeline_stuck AS
SELECT
  dataset_id,
  last_event_at,
  ROUND(EXTRACT(EPOCH FROM (NOW() - last_event_at)) / 3600.0, 2) AS hours_since_last_event
FROM pipeline_latest_event
WHERE last_event_at < NOW() - INTERVAL '24 hours';
