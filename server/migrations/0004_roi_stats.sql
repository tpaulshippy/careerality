-- Precomputed feed totals for pagedRoi (see routes/roi.ts).
--
-- Default and area-filtered feed counts would each scan career_roi (~250k
-- rows). These cells let the endpoint answer from ~112 indexed rows instead.
-- Two full scans here, once, at migrate time. Refreshed by
-- scripts/import_to_d1.sh after every seed. Salary-range and user_id
-- filtered counts stay live (too many combinations to precompute).
-- Idempotent by design (DROP + rebuild) so scripts/import_to_d1.sh can
-- re-apply this file after every seed — the single source of truth for the
-- refresh, not a copy of it.
DROP TABLE IF EXISTS roi_stats;
CREATE TABLE roi_stats (
  key TEXT PRIMARY KEY,
  n INTEGER NOT NULL
);
INSERT INTO roi_stats (key, n)
SELECT 'area:' || area_code, COUNT(*) FROM career_roi
WHERE area_code IS NOT NULL GROUP BY area_code;
INSERT INTO roi_stats (key, n)
SELECT 'area:' || area_code || ':demand', SUM(demand_score IS NOT NULL)
FROM career_roi WHERE area_code IS NOT NULL GROUP BY area_code;
INSERT INTO roi_stats (key, n)
SELECT 'total', COALESCE(SUM(n), 0) FROM roi_stats
WHERE key LIKE 'area:%' AND key NOT LIKE '%:demand';
INSERT INTO roi_stats (key, n)
SELECT 'demand_total', COALESCE(SUM(n), 0) FROM roi_stats
WHERE key LIKE '%:demand';
