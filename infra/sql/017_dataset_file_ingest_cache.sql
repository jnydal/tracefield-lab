-- Capture column names and optional inline file at ingest so UI + scalar extract work
-- when object-store GET fails (e.g. misconfigured S3) or preview cannot list columns.
-- Backward compatible: NULL for existing rows until re-upload.

ALTER TABLE dataset_files ADD COLUMN IF NOT EXISTS ingest_columns_json JSONB NULL;
ALTER TABLE dataset_files ADD COLUMN IF NOT EXISTS inline_file_b64 TEXT NULL;

COMMENT ON COLUMN dataset_files.ingest_columns_json IS 'Header column names at ingest time.';
COMMENT ON COLUMN dataset_files.inline_file_b64 IS 'Base64 file body when upload <= 1MB; fallback if object store read fails.';
