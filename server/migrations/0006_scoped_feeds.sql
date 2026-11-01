-- Scoped feeds: metro rows excluded via generated column + walk index.
--
-- Metro rows (196k, 84% of career_roi) are unreachable through the app's
-- filters yet dominated unscoped feeds and their scans. `feed_area` flags
-- national + state rows (same list as migrations/0003 + FEED_AREA_CODES);
-- feeds predicate on it, and the partial index below serves the default
-- demand sort as an ordered ~20-row walk. (An IN-list directly on area_code
-- does not work in either place: SQLite can't prove query IN-lists imply
-- index IN-lists, so the planner refuses the index.) VIRTUAL = metadata
-- only, no table rewrite. Salary/roi/breakeven sorts walk their covering
-- indexes with the same predicate and stop after LIMIT. One-way migration
-- (ADD COLUMN isn't re-runnable); the refreshable tail lives in
-- scripts/refresh_roi_stats.sql, re-applied by import_to_d1.sh per seed.
DROP INDEX IF EXISTS index_career_roi_demand_feed_scoped;
DROP INDEX IF EXISTS index_career_roi_demand_feed;
ALTER TABLE career_roi ADD COLUMN feed_area INTEGER
  GENERATED ALWAYS AS (area_code IN ('1','2','4','5','6','8','9','10','11','12','13','66','15','16','17','18','19','20','21','22','23','24','25','26','27','28','29','30','31','32','33','34','35','36','37','38','39','40','41','42','72','44','45','46','47','48','99','49','50','78','51','53','54','55','56')) VIRTUAL;
CREATE INDEX index_career_roi_feed_walk ON career_roi
  (demand_score DESC, demand_rank ASC, projected_growth_percent DESC, occupation_code ASC)
  WHERE feed_area = 1 AND demand_score IS NOT NULL;
-- Scoped totals: drop metro cells, recompute national cells from scoped rows.
DELETE FROM roi_stats WHERE key LIKE 'area:%'
  AND key NOT IN ('area:1','area:2','area:4','area:5','area:6','area:8','area:9','area:10','area:11','area:12','area:13','area:66','area:15','area:16','area:17','area:18','area:19','area:20','area:21','area:22','area:23','area:24','area:25','area:26','area:27','area:28','area:29','area:30','area:31','area:32','area:33','area:34','area:35','area:36','area:37','area:38','area:39','area:40','area:41','area:42','area:72','area:44','area:45','area:46','area:47','area:48','area:99','area:49','area:50','area:78','area:51','area:53','area:54','area:55','area:56') AND key NOT IN ('area:1:demand','area:2:demand','area:4:demand','area:5:demand','area:6:demand','area:8:demand','area:9:demand','area:10:demand','area:11:demand','area:12:demand','area:13:demand','area:66:demand','area:15:demand','area:16:demand','area:17:demand','area:18:demand','area:19:demand','area:20:demand','area:21:demand','area:22:demand','area:23:demand','area:24:demand','area:25:demand','area:26:demand','area:27:demand','area:28:demand','area:29:demand','area:30:demand','area:31:demand','area:32:demand','area:33:demand','area:34:demand','area:35:demand','area:36:demand','area:37:demand','area:38:demand','area:39:demand','area:40:demand','area:41:demand','area:42:demand','area:72:demand','area:44:demand','area:45:demand','area:46:demand','area:47:demand','area:48:demand','area:99:demand','area:49:demand','area:50:demand','area:78:demand','area:51:demand','area:53:demand','area:54:demand','area:55:demand','area:56:demand');
DELETE FROM roi_stats WHERE key = 'total' OR key = 'demand_total';
INSERT INTO roi_stats (key, n)
SELECT 'total', COUNT(*) FROM career_roi WHERE feed_area = 1;
INSERT INTO roi_stats (key, n)
SELECT 'demand_total', COUNT(*) FROM career_roi
WHERE demand_score IS NOT NULL AND feed_area = 1;
ANALYZE career_roi;
