-- Seed scalar feature values for the Heat/Crime demo (Phase 1).
-- Run this after Step 4 (resolution and feature definitions exist) and before Step 5 (analysis job).
-- Requires: datasets "NYC Crime Statistics 2023" and "NYC Ice Cream Sales 2023",
--           resolution jobs completed so entity_map has source_record_id -> entity_id,
--           feature definitions "total_incidents" and "units_sold_thousands".
-- Idempotent: deletes existing feature rows for these defs from these datasets, then inserts.

-- Remove any existing scalar features for these demo feature defs (re-run safe)
DELETE FROM features
WHERE feature_definition_id IN (
  SELECT id FROM feature_definitions WHERE name IN ('total_incidents', 'units_sold_thousands')
)
AND dataset_id IN (
  SELECT id FROM datasets WHERE name IN ('NYC Crime Statistics 2023', 'NYC Ice Cream Sales 2023')
);

-- Crime: total_incidents per month (source_record_id = crime_record_id)
INSERT INTO features (id, entity_id, dataset_id, feature_definition_id, value_num, value_text, provenance_json, created_at)
SELECT gen_random_uuid(), em.entity_id, em.dataset_id, fd.id, v.value_num::double precision, NULL, '{"source":"demo-seed-heatcrime"}'::jsonb, NOW()
FROM entity_map em
JOIN datasets d ON d.id = em.dataset_id
JOIN feature_definitions fd ON fd.name = 'total_incidents'
CROSS JOIN (VALUES
  ('NYC-CRIME-2023-01', 5821), ('NYC-CRIME-2023-02', 5244), ('NYC-CRIME-2023-03', 6138),
  ('NYC-CRIME-2023-04', 6912), ('NYC-CRIME-2023-05', 7803), ('NYC-CRIME-2023-06', 9187),
  ('NYC-CRIME-2023-07', 10412), ('NYC-CRIME-2023-08', 10108), ('NYC-CRIME-2023-09', 8934),
  ('NYC-CRIME-2023-10', 7612), ('NYC-CRIME-2023-11', 6423), ('NYC-CRIME-2023-12', 5908)
) AS v(source_record_id, value_num)
WHERE em.source_record_id = v.source_record_id AND d.name = 'NYC Crime Statistics 2023';

-- Ice cream: units_sold_thousands per month (source_record_id = period_id)
INSERT INTO features (id, entity_id, dataset_id, feature_definition_id, value_num, value_text, provenance_json, created_at)
SELECT gen_random_uuid(), em.entity_id, em.dataset_id, fd.id, v.value_num::double precision, NULL, '{"source":"demo-seed-heatcrime"}'::jsonb, NOW()
FROM entity_map em
JOIN datasets d ON d.id = em.dataset_id
JOIN feature_definitions fd ON fd.name = 'units_sold_thousands'
CROSS JOIN (VALUES
  ('ICECREAM-JAN-2023', 11.8), ('ICECREAM-FEB-2023', 13.6), ('ICECREAM-MAR-2023', 22.1),
  ('ICECREAM-APR-2023', 38.4), ('ICECREAM-MAY-2023', 67.9), ('ICECREAM-JUN-2023', 111.7),
  ('ICECREAM-JUL-2023', 148.2), ('ICECREAM-AUG-2023', 142.5), ('ICECREAM-SEP-2023', 98.3),
  ('ICECREAM-OCT-2023', 51.6), ('ICECREAM-NOV-2023', 27.4), ('ICECREAM-DEC-2023', 15.9)
) AS v(source_record_id, value_num)
WHERE em.source_record_id = v.source_record_id AND d.name = 'NYC Ice Cream Sales 2023';
