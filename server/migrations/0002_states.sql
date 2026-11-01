-- Materialized state lookup for GET /api/areas/states.
--
-- The endpoint's GLOB/length predicates can't use the area_code index, so
-- deriving states from career_roi costs a full-table scan per request
-- (~400k row reads each on the current seed). This table holds the ~55
-- derived rows; the endpoint reads it instead.
--
-- Populated here from existing data (one scan, once) and refreshed by
-- scripts/import_to_d1.sh after every seed. Fresh DBs import career_roi
-- after migrations run, so the table starts empty there by design — the
-- endpoint falls back to the live derivation (and backfills) when empty.
CREATE TABLE states (
  area_code TEXT PRIMARY KEY,
  area_name TEXT NOT NULL
);
INSERT INTO states (area_code, area_name)
SELECT area_code, area_name FROM career_roi
WHERE (
  area_code NOT GLOB '*[^0-9]*'
  AND area_code GLOB '[0-9]*'
  AND length(area_code) <= 2
  AND area_name NOT LIKE '%,%'
)
GROUP BY area_code, area_name;
