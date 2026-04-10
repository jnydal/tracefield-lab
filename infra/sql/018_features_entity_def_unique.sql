-- Prevent duplicate (entity, feature_definition) rows within the same dataset.
-- Partial index excludes NULL dataset_id because Postgres treats NULLs as
-- distinct in unique indexes; scalar extract always sets dataset_id non-null.
CREATE UNIQUE INDEX IF NOT EXISTS features_entity_def_dataset_uniq
    ON features (entity_id, feature_definition_id, dataset_id)
    WHERE dataset_id IS NOT NULL;
