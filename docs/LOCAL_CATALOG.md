# Local-first catalog bundle (offline faceted search)

The Expo app ships a slim, fully offline career catalog:
`client/assets/data/catalog.v1.json`. It powers offline lookup and search
(by area, occupation name, and salary bounds) with zero network calls.
The bundle is generated from **local Postgres** by
`server/scripts/export_pg_to_catalog.py` and committed to the repo.

## What the bundle is

One JSON document, format `version: 1`:

- `areas` / `occupations` / `industries` — dimension tables: `{c: code,
  n: name}`. `areas` lists national `"99"` first, then the rest by area
  code; occupations/industries are sorted by code. Industries omit empty
  codes.
- `rows` — one compact array per `career_roi` record, ordered by
  `(area_code, occupation_code)`:
  `[occIdx, areaIdx, id, salary, eduCost, breakeven, roi, jobZone, eduLevel,
  indIdx, demandRank, demandScore, openings, growth, colIndex, adjSalary]`.
  The `*Idx` values are 0-based indexes into the dimension tables
  (`indIdx` is `null` when the industry code is empty). `id` is the Postgres
  `career_roi` id, used for swipe joins.
- `map` — per-area aggregates keyed by area index, mirroring
  `GET /api/roi/map_summary` semantics: `count`, `AVG(annual_median_salary)`,
  `AVG(adjusted_salary)`, median ROI (`percentile_cont(0.5)` over non-null),
  `highRoi` (ROI ≥ 15), `demandCount` (either demand column set),
  `demandAvgRank`. Unlike the server endpoint (states only), the bundle map
  covers every bundled area including national `"99"`.
- Number shapes: money (`salary`, `eduCost`, `adjSalary`) as whole dollars;
  `roi`/`growth`/`colIndex` rounded to 2dp; `demandScore` to 4dp; map averages
  to 2dp. `NULL` stays `null` — never 0 or `""`.
- Excluded on purpose (detail-only, fetched per-career from the server at
  runtime): `skills`, `day_in_life_*`, `video_url`, cost-of-living columns
  beyond `col_index`, timestamps.

Default export = the 55 feed areas (national `99` + states/territories, no
metros), matching the server's feed scope. `--include-metros` restores the
full export; `--areas 99,6,48` overrides with an explicit allowlist.

## Refresh flow

1. **Run the exporter against local Postgres.** Connection follows the same
   conventions as `export_pg_to_sqlite.py`: `DATABASE_URL` if set, else
   `PGDATABASE`/`PGUSER`/`PGPASSWORD`/`PGHOST` (defaults
   `careerality`/`postgres`/`postgres`/`localhost`). The connection is
   read-only; the script issues only `SELECT`s.
   ```sh
   python server/scripts/export_pg_to_catalog.py
   # or: python server/scripts/export_pg_to_catalog.py --out /tmp/catalog.v1.json
   ```
2. **Inspect the size report.** The script prints byte/KB totals and
   bytes-per-row. Rough guide: ~13k rows × ~150 B/row ≈ ~2 MB. If the number
   jumps unexpectedly, check for a data regression before committing.
3. **Commit the bundle.** `client/assets/data/catalog.v1.json` is a build
   input checked into git — new installs bundle whatever is committed.
4. **Release the app.** Ship a store build, or push an OTA update (see
   below). New installs and updated clients get the new data with no server
   change.

## Backend compatibility

`server/src` is untouched by this flow. Old app clients keep calling
`/api/*` exactly as before; the bundle is additive — a separate offline lane
that never alters API behavior. Server migrations, the deploy config, and the
edge-database export pipeline are independent of the catalog.

## No edge-database guarantee

`export_pg_to_catalog.py` talks only to local Postgres via `psycopg2`. It
never imports or invokes the deploy CLI, the edge database, or any
edge-vendor API — search the script for those tool/vendor names
(case-insensitive) and expect zero hits.
The bundle path also never touches the `export/` SQL chunk pipeline.

## EAS Update option (data-only refreshes)

Because the catalog is just a bundled JSON asset, a data-only refresh does
not need a store resubmission: bump the data, then publish with
`eas update` and clients on a compatible runtime pull the new bundle OTA.
Reserve full builds for native/code changes; use EAS Update for catalog-only
refreshes.
