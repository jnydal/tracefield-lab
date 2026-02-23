-- HNSW index for cosine similarity search on embeddings_1024
-- Uses vector_cosine_ops for <=> (cosine distance) operator
CREATE INDEX IF NOT EXISTS embeddings_1024_vector_hnsw_idx
  ON embeddings_1024
  USING hnsw (vector vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
