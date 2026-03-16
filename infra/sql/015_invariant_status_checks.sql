-- Invariant guardrails: restrict job_status and analysis_jobs to allowed status values.
-- See docs/INVARIANTS.md. Backward compatible: only adds constraints; existing rows must already use allowed values.

-- job_status.status: QUEUED | STARTED | FINISHED | FAILED
ALTER TABLE job_status
  DROP CONSTRAINT IF EXISTS job_status_status_allowed;

ALTER TABLE job_status
  ADD CONSTRAINT job_status_status_allowed
  CHECK (status IN ('QUEUED', 'STARTED', 'FINISHED', 'FAILED'));

-- analysis_jobs.status: queued | running | completed | failed
ALTER TABLE analysis_jobs
  DROP CONSTRAINT IF EXISTS analysis_jobs_status_allowed;

ALTER TABLE analysis_jobs
  ADD CONSTRAINT analysis_jobs_status_allowed
  CHECK (status IN ('queued', 'running', 'completed', 'failed'));
