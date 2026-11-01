-- Precomputed map aggregates for GET /api/roi/map_summary (see routes/roi.ts).
--
-- The live computation needs two full career_roi scans (GROUP BY aggregates
-- plus the ordered roi_percentage fetch for JS medians) on every map view.
-- This table holds one row per state area (~55 rows); the endpoint serves it
-- directly. Filled by scripts/export_pg_to_sqlite.py (map_summary.sql, where
-- Postgres computes the aggregates incl. percentile_cont medians) and loaded
-- by scripts/import_to_d1.sh. Empty on fresh DBs — the endpoint falls back
-- to the live computation then.
CREATE TABLE roi_map_summary (
  area_code TEXT PRIMARY KEY,
  n INTEGER NOT NULL,
  avg_salary REAL,
  avg_adjusted REAL,
  median_roi REAL,
  high_roi_count INTEGER NOT NULL,
  demand_count INTEGER NOT NULL,
  demand_avg_rank REAL
);

-- Ordered feed index for the default demand sort. The feed's WHERE always
-- carries `demand_score IS NOT NULL` (see demandOnly in routes/roi.ts), so
-- this partial index both filters and orders: page queries walk ~20 index
-- rows instead of scanning + sorting the table. Covers the ORDER BY tail
-- (rank, growth, code) so no sort step remains.
CREATE INDEX index_career_roi_demand_feed ON career_roi
  (demand_score DESC, demand_rank ASC, projected_growth_percent DESC, occupation_code ASC)
  WHERE demand_score IS NOT NULL;
