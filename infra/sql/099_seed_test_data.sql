-- Seed test data for pipeline validation (thor.nydal@uptimeconsulting.no)
-- Run: docker compose exec -T db psql -U postgres -d tracefield -f - < infra/sql/099_seed_test_data.sql
-- Or:  docker compose exec db psql -U postgres -d tracefield -f /docker-entrypoint-initdb.d/099_seed_test_data.sql
-- (latter works if infra/sql is mounted; for init, this runs only on fresh DB)

-- Re-runnable: remove previous seed data
DELETE FROM analysis_results WHERE job_id = '55555555-5555-5555-5555-555555555555'::uuid;
DELETE FROM analysis_jobs WHERE id = '55555555-5555-5555-5555-555555555555'::uuid;
DELETE FROM features WHERE dataset_id = '22222222-2222-2222-2222-222222222222'::uuid;
DELETE FROM entity_map WHERE dataset_id = '22222222-2222-2222-2222-222222222222'::uuid;
DELETE FROM entities WHERE id IN (
  '33333333-3333-3333-3333-333333333301'::uuid,
  '33333333-3333-3333-3333-333333333302'::uuid,
  '33333333-3333-3333-3333-333333333303'::uuid
);
DELETE FROM feature_definitions WHERE id IN (
  '44444444-4444-4444-4444-444444444401'::uuid,
  '44444444-4444-4444-4444-444444444402'::uuid
);
DELETE FROM datasets WHERE id = '22222222-2222-2222-2222-222222222222'::uuid;

-- 1. Create user (no password; use OAuth or register to set one)
INSERT INTO users (id, email, display_name, created_at, updated_at)
VALUES (
  '11111111-1111-1111-1111-111111111111'::uuid,
  'thor.nydal@uptimeconsulting.no',
  'Thor Nydal',
  now(),
  now()
)
ON CONFLICT (email) DO NOTHING;

-- 2. Dataset
INSERT INTO datasets (id, name, description, source, license, schema_json, created_at, updated_at)
VALUES (
  '22222222-2222-2222-2222-222222222222'::uuid,
  'test-survey-2024',
  'Test survey dataset for pipeline validation',
  'https://example.org/test',
  'CC-BY-4.0',
  '{"columns":[{"name":"id","type":"string"},{"name":"name","type":"string"},{"name":"score","type":"number"}]}',
  now(),
  now()
);

-- 3. Entities
INSERT INTO entities (id, entity_type, display_name, external_ids, created_at, updated_at)
VALUES
  ('33333333-3333-3333-3333-333333333301'::uuid, 'person', 'Alice', '{"source_id":"rec-001"}'::jsonb, now(), now()),
  ('33333333-3333-3333-3333-333333333302'::uuid, 'person', 'Bob', '{"source_id":"rec-002"}'::jsonb, now(), now()),
  ('33333333-3333-3333-3333-333333333303'::uuid, 'person', 'Carol', '{"source_id":"rec-003"}'::jsonb, now(), now());

-- 4. Entity mappings
INSERT INTO entity_map (id, dataset_id, entity_id, source_record_id, source_keys, method, score, created_at)
VALUES
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222'::uuid, '33333333-3333-3333-3333-333333333301'::uuid, 'rec-001', '{"id":"rec-001","name":"Alice"}'::jsonb, 'exact', 1.0, now()),
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222'::uuid, '33333333-3333-3333-3333-333333333302'::uuid, 'rec-002', '{"id":"rec-002","name":"Bob"}'::jsonb, 'exact', 1.0, now()),
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222'::uuid, '33333333-3333-3333-3333-333333333303'::uuid, 'rec-003', '{"id":"rec-003","name":"Carol"}'::jsonb, 'exact', 1.0, now());

-- 5. Feature definitions
INSERT INTO feature_definitions (id, name, description, value_type, unit, owner, created_at)
VALUES
  ('44444444-4444-4444-4444-444444444401'::uuid, 'score', 'Survey score', 'number', null, 'thor.nydal@uptimeconsulting.no', now()),
  ('44444444-4444-4444-4444-444444444402'::uuid, 'age_group', 'Age group category', 'string', null, 'thor.nydal@uptimeconsulting.no', now());

-- 6. Features
INSERT INTO features (id, entity_id, dataset_id, feature_definition_id, value_num, value_text, provenance_json, created_at)
VALUES
  (gen_random_uuid(), '33333333-3333-3333-3333-333333333301'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, '44444444-4444-4444-4444-444444444401'::uuid, 85.5, null, '{"source":"test-seed"}'::jsonb, now()),
  (gen_random_uuid(), '33333333-3333-3333-3333-333333333301'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, '44444444-4444-4444-4444-444444444402'::uuid, null, '25-34', '{"source":"test-seed"}'::jsonb, now()),
  (gen_random_uuid(), '33333333-3333-3333-3333-333333333302'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, '44444444-4444-4444-4444-444444444401'::uuid, 72.0, null, '{"source":"test-seed"}'::jsonb, now()),
  (gen_random_uuid(), '33333333-3333-3333-3333-333333333302'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, '44444444-4444-4444-4444-444444444402'::uuid, null, '35-44', '{"source":"test-seed"}'::jsonb, now()),
  (gen_random_uuid(), '33333333-3333-3333-3333-333333333303'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, '44444444-4444-4444-4444-444444444401'::uuid, 91.2, null, '{"source":"test-seed"}'::jsonb, now()),
  (gen_random_uuid(), '33333333-3333-3333-3333-333333333303'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, '44444444-4444-4444-4444-444444444402'::uuid, null, '25-34', '{"source":"test-seed"}'::jsonb, now());

-- 7. Analysis job (requested_by uses existing user by email)
INSERT INTO analysis_jobs (id, name, status, config_json, requested_by, created_at)
VALUES (
  '55555555-5555-5555-5555-555555555555'::uuid,
  'Test run - score vs age_group',
  'queued',
  '{"leftFeatureSet":"score","rightFeatureSet":"age_group","test":"anova","correction":"benjamini-hochberg"}'::jsonb,
  (SELECT id FROM users WHERE email = 'thor.nydal@uptimeconsulting.no' LIMIT 1),
  now()
);
