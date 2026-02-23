-- Feature definition for BGE 1024-dim embeddings (used when analysis references embeddings.bge_large)
INSERT INTO feature_definitions (id, name, description, value_type, unit, owner, config_json, created_at)
VALUES (
  '66666666-6666-6666-6666-666666666601'::uuid,
  'embeddings.bge_large',
  'BGE-large 1024-dim text embeddings; use leftDimension/rightDimension in analysis config',
  'vector',
  null,
  'tracefield',
  '{"model":"BAAI/bge-large-en-v1.5","dim":1024}'::jsonb,
  now()
)
ON CONFLICT (name) DO NOTHING;
