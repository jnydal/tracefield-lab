CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE provenance_event (
  id BIGSERIAL PRIMARY KEY,
  person_id UUID,
  entity_id UUID,
  dataset_id UUID,
  job_id UUID,
  stage TEXT,              -- pipeline stage
  detail JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
