-- Resolution jobs for semantic entity resolution
-- Backward compatible: new table only

CREATE TABLE IF NOT EXISTS resolution_jobs (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  config_json JSONB NOT NULL,
  dataset_id UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  result_summary JSONB,
  exc_info TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS resolution_jobs_status_idx ON resolution_jobs(status);
CREATE INDEX IF NOT EXISTS resolution_jobs_dataset_idx ON resolution_jobs(dataset_id);

-- Unique constraint for entity_map upsert by (dataset_id, source_record_id)
-- Only add if source_record_id is non-null; multiple nulls allowed for legacy data
CREATE UNIQUE INDEX IF NOT EXISTS entity_map_dataset_source_record_idx
  ON entity_map (dataset_id, source_record_id)
  WHERE source_record_id IS NOT NULL;
