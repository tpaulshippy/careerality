# Careerality API — Cloudflare Worker (Hono + D1/SQLite)

Node backend runnable as a Cloudflare Worker. Replaces the former Ruby on
Rails + PostgreSQL server; the HTTP API is route- and shape-compatible so the
Expo client works unchanged (`EXPO_PUBLIC_API_URL` points at the worker).

## Endpoints

| Method & path | Description |
|---|---|
| `GET /api/careers` | Selectable occupations, 10/page (`?page=`) |
| `GET /api/careers/:id` | One occupation (accepts `XX-XXXX.00`, `XX-XXXX`, `XXXXXX`) |
| `GET /api/roi` | Career ROI feed, 20/page. `?sort=demand\|roi\|salary\|breakeven`, `?area_code=` (aliases `area`, `location`), `?min_salary=`/`?salary_min=`, `?max_salary=`/`?salary_max=`, `?user_id=` excludes swiped |
| `GET /api/roi/by_salary`, `/by_roi`, `/by_breakeven` | Top lists, 50/page (`?area=`, default `99`) |
| `GET /api/roi/search?q=&area=` | Name search (400 without `q`) |
| `GET /api/roi/map_summary` | Per-state aggregates for the map |
| `GET /api/roi/:id?area=` | One ROI row (default area `99`) |
| `GET /api/areas/states` | State list for filters |
| `GET /api/swipes?user_id=` | Swipe history, newest first |
| `GET /api/swipes/liked?user_id=` | Right-swiped careers with content |
| `POST /api/swipes` | `{ career_id, user_id, direction: left\|right, feedback? }` |
| `DELETE /api/swipes/:id?user_id=` | Remove one swipe |
| `DELETE /api/swipes/destroy_all?user_id=` | Remove all of a user's swipes |
| `POST /api/jev/rank` | `{ swipes, candidates[<=50] }` → ranked `{ results }` |
| `GET /up`, `GET /` | Health checks |

Error/status codes mirror Rails: 400 invalid code or missing `q`/`user_id`,
404 unknown record, 422 invalid swipe payload or >50 Jev candidates.

## Local development

```bash
npm install
cp .env.example .dev.vars   # fill in TYPESAFE_API_KEY for live Jev ranking
npm run db:migrate:local    # create schema in the local D1 copy
npx wrangler dev            # serves the API at http://127.0.0.1:8787
```

`wrangler dev` uses a local D1 database automatically. Seed it with a slice
of production data via the export script pointed at a Postgres copy:

```bash
DATABASE_URL=postgres://... python scripts/export_pg_to_sqlite.py --out /tmp/x
for f in /tmp/x/chunk_*.sql; do \
  npx wrangler d1 execute careerality --local --file "$f"; done
```

Without `TYPESAFE_API_KEY`, `POST /api/jev/rank` returns candidates in input
order (`provider: "fallback"`) — same as Rails without the key.

## Cloudflare setup (one time)

```bash
npx wrangler d1 create careerality   # paste database_id into wrangler.toml
npx wrangler secret put TYPESAFE_API_KEY
npm run db:migrate:remote            # applies migrations/ to the remote D1
npx wrangler deploy                   # deploys the worker (migrations are NOT auto-applied)
```

Recommended production routing on `careerality.app`:

- `careerality.app/api/*` → this worker (keeps the client same-origin),
- `careerality.app/*` → Pages project serving `client/dist`.

CORS allowlist comes from `CORS_ORIGINS` (default `https://careerality.app`).

## Data migration (Postgres → D1)

Only the tables the API reads are migrated (the **minimal serving set**).
Raw ETL tables (`salaries`, `bls_state_wages`, `ipeds_*`, `onet_*`,
`*_crosswalk`, `state_employment_projections`, `career_profiles`, …) stay in
Postgres with the `data/` pipeline and are not needed at runtime:

| Table | Rows are | Used by |
|---|---|---|
| `career_roi` | denormalized serving rows (occupation × area × industry) | all `/api/roi/*` |
| `career_contents` | day-in-the-life narratives + video | roi payloads, liked |
| `salary_occupations` | occupation directory | `/api/careers` |
| `career_images` | generated images (no endpoint reads it yet, same as Rails) | future |
| `swipes` | per-device swipe history | `/api/swipes*`, roi exclusion |

SQLite type mapping: `SERIAL` → `INTEGER PRIMARY KEY AUTOINCREMENT`,
`JSONB` → `TEXT` (parsed on serialize), all seven decimal columns
(`annual_median_salary`, `education_cost`, `roi_percentage`,
`cost_of_living_index`, `adjusted_salary`, `projected_growth_percent`,
`demand_score`) → `REAL` in storage but serialized back to Rails-style
numeric strings (e.g. `"50000.0"`), timestamps → ISO-8601 `TEXT`.

Run:

```bash
# 1. Dump from Postgres into chunked, D1-safe INSERT files + counts.json
DATABASE_URL=postgres://user:pass@host/careerality \
  python scripts/export_pg_to_sqlite.py --out export

# 2. Import chunks (applies pending migrations first, aborts on non-empty
#    tables unless FORCE=1; see the script header to clear a partial import)
./scripts/import_to_d1.sh export --remote
```

Verification compares `COUNT(*)` per table against `export/counts.json` and
fails loudly on mismatch. Postgres/PostGIS-isms to watch: none of the five
tables use exotic types — the one rewrite is `map_summary`, where the
Postgres `PERCENTILE_CONT` / `FILTER (WHERE …)` / `~` regex aggregate is
expressed as plain `GROUP BY` + JS median (covered by tests).

D1 limits to keep in mind: `career_roi` is the large table (occupation ×
area × industry rows); chunks of 4000 multi-row INSERTs stay within D1's
per-statement limits. If `wrangler d1 execute --file` ever rejects a chunk,
re-run the export with `--chunk-rows 1000`.
