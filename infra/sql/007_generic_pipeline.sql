CREATE TABLE IF NOT EXISTS datasets (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NULL,
    source TEXT NULL,
    license TEXT NULL,
    schema_json JSONB NULL,
    refresh_schedule TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS datasets_name_idx ON datasets (name);

CREATE TABLE IF NOT EXISTS dataset_files (
    id UUID PRIMARY KEY,
    dataset_id UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    object_uri TEXT NOT NULL,
    filename TEXT NULL,
    content_type TEXT NULL,
    size_bytes BIGINT NULL,
    checksum TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dataset_files_dataset_idx ON dataset_files (dataset_id);

CREATE TABLE IF NOT EXISTS entities (
    id UUID PRIMARY KEY,
    entity_type TEXT NOT NULL,
    display_name TEXT NULL,
    external_ids JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS entities_type_idx ON entities (entity_type);

CREATE TABLE IF NOT EXISTS entity_map (
    id UUID PRIMARY KEY,
    dataset_id UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    source_record_id TEXT NULL,
    source_keys JSONB NULL,
    method TEXT NULL,
    score DOUBLE PRECISION NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS entity_map_dataset_idx ON entity_map (dataset_id);
CREATE INDEX IF NOT EXISTS entity_map_entity_idx ON entity_map (entity_id);

CREATE TABLE IF NOT EXISTS feature_definitions (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NULL,
    value_type TEXT NOT NULL,
    unit TEXT NULL,
    owner TEXT NULL,
    config_json JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS feature_definitions_name_idx ON feature_definitions (name);

CREATE TABLE IF NOT EXISTS features (
    id UUID PRIMARY KEY,
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    dataset_id UUID NULL REFERENCES datasets(id) ON DELETE SET NULL,
    feature_definition_id UUID NOT NULL REFERENCES feature_definitions(id) ON DELETE CASCADE,
    value_json JSONB NULL,
    value_num DOUBLE PRECISION NULL,
    value_text TEXT NULL,
    value_bool BOOLEAN NULL,
    value_ts TIMESTAMPTZ NULL,
    provenance_json JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS features_entity_idx ON features (entity_id);
CREATE INDEX IF NOT EXISTS features_dataset_idx ON features (dataset_id);
CREATE INDEX IF NOT EXISTS features_definition_idx ON features (feature_definition_id);

CREATE TABLE IF NOT EXISTS analysis_jobs (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL,
    config_json JSONB NOT NULL,
    requested_by UUID NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at TIMESTAMPTZ NULL,
    ended_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS analysis_jobs_status_idx ON analysis_jobs (status);

CREATE TABLE IF NOT EXISTS analysis_results (
    id UUID PRIMARY KEY,
    job_id UUID NOT NULL REFERENCES analysis_jobs(id) ON DELETE CASCADE,
    feature_x_id UUID NOT NULL REFERENCES feature_definitions(id) ON DELETE CASCADE,
    feature_y_id UUID NOT NULL REFERENCES feature_definitions(id) ON DELETE CASCADE,
    stats_json JSONB NOT NULL,
    p_value DOUBLE PRECISION NULL,
    effect_size DOUBLE PRECISION NULL,
    correction TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analysis_results_job_idx ON analysis_results (job_id);
CREATE INDEX IF NOT EXISTS analysis_results_features_idx ON analysis_results (feature_x_id, feature_y_id);

ALTER TABLE provenance_event
    ADD COLUMN IF NOT EXISTS entity_id UUID NULL,
    ADD COLUMN IF NOT EXISTS dataset_id UUID NULL,
    ADD COLUMN IF NOT EXISTS job_id UUID NULL;
