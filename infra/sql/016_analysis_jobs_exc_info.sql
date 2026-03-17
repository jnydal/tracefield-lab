-- Store failure reason for analysis jobs (for UI and debugging).
-- Backward compatible: new column is nullable.
ALTER TABLE analysis_jobs
  ADD COLUMN IF NOT EXISTS exc_info TEXT NULL;
