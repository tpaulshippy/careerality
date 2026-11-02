#!/usr/bin/env python3
"""Export a slim offline catalog bundle from LOCAL Postgres for the Expo app.

The bundle lets the app do faceted search fully offline: dimension tables
(areas / occupations / industries) plus one compact row per career_roi record
(indexed triples + numbers only). Detail-only columns (skills, day-in-life
text, video_url, extra cost-of-living columns, timestamps) are EXCLUDED --
the app fetches those per-career from the server at runtime.

LOCAL Postgres only. This script never imports or calls any deploy CLI,
edge database, or edge-vendor API: it opens a read-only psycopg2 connection
and writes one JSON file.

Usage:
    python server/scripts/export_pg_to_catalog.py [--out PATH]
    python server/scripts/export_pg_to_catalog.py --include-metros
    python server/scripts/export_pg_to_catalog.py --areas 99,6,48

    DATABASE_URL=postgres://... python server/scripts/export_pg_to_catalog.py
    PGDATABASE=mydb PGUSER=me PGPASSWORD=secret PGHOST=db.internal \\
        python server/scripts/export_pg_to_catalog.py

Output (default: <repo>/client/assets/data/catalog.v1.json):
    {"version":1,"generated_at":"<UTC ISO>","source":"postgres",
     "counts":{"rows":N,"occupations":M,"areas":K,"industries":J},
     "areas":[{"c":"99","n":"National"}, ...],   # "99" first, then by code
     "occupations":[{"c":"...","n":"..."}],       # sorted by code
     "industries":[{"c":"...","n":"..."}],        # sorted by code, no empties
     "rows":[[occIdx,areaIdx,id,salary,eduCost,breakeven,roi,jobZone,
              eduLevel,indIdx,demandRank,demandScore,openings,growth,
              colIndex,adjSalary], ...],          # ordered by (area,occ)
     "map":{"<areaIdx>":{"count":N,"avgSalary":x,"adjSalary":x,
                         "medianRoi":x,"highRoi":N,
                         "demandCount":N,"demandAvgRank":x}}}
"""

import argparse
import datetime
import json
import os
import sys
from pathlib import Path

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    sys.exit("psycopg2 is required (pip install -r ../../data/requirements.txt)")

# Default area filter: national + states/territories, no metros.
# Reused from export_pg_to_sqlite.py FEED_AREA_CODES (mirrors
# server/migrations/0003 and server/src/routes/roi.ts FEED_AREA_CODES).
# Duplicated here (with import attempt below) so this script stays a single
# self-contained file when copied or run standalone.
FEED_AREA_CODES = [
    "1", "2", "4", "5", "6", "8", "9", "10", "11", "12", "13", "66", "15",
    "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "27",
    "28", "29", "30", "31", "32", "33", "34", "35", "36", "37", "38", "39",
    "40", "41", "42", "72", "44", "45", "46", "47", "48", "99", "49", "50",
    "78", "51", "53", "54", "55", "56",
]
try:
    from export_pg_to_sqlite import FEED_AREA_CODES as FEED_AREA_CODES  # noqa: F401
except ImportError:
    pass  # fallback: the duplicated list above (kept in sync by comment link)

# Read-only SELECTs only. Columns are the slim offline subset; detail-only
# columns (skills, day_in_life_*, video_url, cost_of_living beyond col_index,
# timestamps) are deliberately never selected.
ROW_COLUMNS = (
    "id",
    "occupation_code",
    "occupation_name",
    "area_code",
    "area_name",
    "annual_median_salary",
    "education_cost",
    "years_to_breakeven",
    "roi_percentage",
    "job_zone",
    "education_level",
    "industry_code",
    "industry_name",
    "demand_rank",
    "demand_score",
    "avg_annual_openings",
    "projected_growth_percent",
    "cost_of_living_index",
    "adjusted_salary",
)

HIGH_ROI_THRESHOLD = 15


def get_connection():
    url = os.environ.get("DATABASE_URL")
    if url:
        return psycopg2.connect(url)
    return psycopg2.connect(
        dbname=os.environ.get("PGDATABASE", "careerality"),
        user=os.environ.get("PGUSER", "postgres"),
        password=os.environ.get("PGPASSWORD", "postgres"),
        host=os.environ.get("PGHOST", "localhost"),
    )


def _money(value):
    """Whole-dollar number, or None preserved (never 0-substituted)."""
    if value is None:
        return None
    return int(round(float(value)))


def _r2(value):
    if value is None:
        return None
    return round(float(value), 2)


def _r4(value):
    if value is None:
        return None
    return round(float(value), 4)


def _int(value):
    if value is None:
        return None
    return int(value)


def _code(value):
    if value is None:
        return None
    text = str(value).strip()
    return text if text else None


def fetch_rows(cursor, where):
    cursor.execute(
        "SELECT " + ", ".join(ROW_COLUMNS) + " FROM career_roi"
        + (f" WHERE {where}" if where else "")
        + " ORDER BY area_code, occupation_code"
    )
    names = [d.name for d in cursor.description]
    return [dict(zip(names, row)) for row in cursor.fetchall()]


def fetch_map(cursor, where):
    """Per-area aggregates mirroring GET /api/roi/map_summary semantics.

    Same definitions as export_pg_to_sqlite.export_map_summary (COUNT,
    AVG salaries, percentile_cont median over non-null roi, high-roi count at
    >= 15, demand counted when either demand column is set, AVG demand_rank
    over non-nulls) -- but grouped over the exported area set, which includes
    national "99" so every bundled area has a map entry.
    """
    cursor.execute(
        """
        SELECT area_code,
          COUNT(*) AS n,
          AVG(annual_median_salary) AS avg_salary,
          AVG(adjusted_salary) AS avg_adjusted,
          percentile_cont(0.5) WITHIN GROUP (ORDER BY roi_percentage)
            FILTER (WHERE roi_percentage IS NOT NULL) AS median_roi,
          SUM(CASE WHEN roi_percentage >= 15 THEN 1 ELSE 0 END)
            AS high_roi_count,
          SUM(CASE WHEN demand_score IS NOT NULL OR demand_rank IS NOT NULL
            THEN 1 ELSE 0 END) AS demand_count,
          AVG(demand_rank) AS demand_avg_rank
        FROM career_roi
        """
        + (f" WHERE {where}" if where else "")
        + " GROUP BY area_code"
    )
    names = [d.name for d in cursor.description]
    return {row[0]: dict(zip(names, row)) for row in cursor.fetchall()}


def build_catalog(rows, aggregates):
    areas = {}
    occupations = {}
    industries = {}
    for r in rows:
        if r["area_code"] not in areas:
            areas[r["area_code"]] = r["area_name"]
        if r["occupation_code"] not in occupations:
            occupations[r["occupation_code"]] = r["occupation_name"]
        ind = _code(r["industry_code"])
        if ind is not None and ind not in industries:
            industries[ind] = r["industry_name"]

    area_codes = sorted(areas, key=lambda c: (c != "99", c))
    occ_codes = sorted(occupations)
    ind_codes = sorted(industries)
    area_idx = {c: i for i, c in enumerate(area_codes)}
    occ_idx = {c: i for i, c in enumerate(occ_codes)}
    ind_idx = {c: i for i, c in enumerate(ind_codes)}

    out_rows = []
    for r in rows:
        ind = _code(r["industry_code"])
        out_rows.append([
            occ_idx[r["occupation_code"]],
            area_idx[r["area_code"]],
            _int(r["id"]),
            _money(r["annual_median_salary"]),
            _money(r["education_cost"]),
            _int(r["years_to_breakeven"]),
            _r2(r["roi_percentage"]),
            _int(r["job_zone"]),
            r["education_level"],
            ind_idx[ind] if ind is not None else None,
            _int(r["demand_rank"]),
            _r4(r["demand_score"]),
            _int(r["avg_annual_openings"]),
            _r2(r["projected_growth_percent"]),
            _r2(r["cost_of_living_index"]),
            _money(r["adjusted_salary"]),
        ])

    area_map = {}
    for code, i in area_idx.items():
        agg = aggregates.get(code, {})
        area_map[str(i)] = {
            "count": int(agg.get("n", 0) or 0),
            "avgSalary": _r2(agg.get("avg_salary")),
            "adjSalary": _r2(agg.get("avg_adjusted")),
            "medianRoi": _r2(agg.get("median_roi")),
            "highRoi": int(agg.get("high_roi_count", 0) or 0),
            "demandCount": int(agg.get("demand_count", 0) or 0),
            "demandAvgRank": _r2(agg.get("demand_avg_rank")),
        }

    return {
        "version": 1,
        "generated_at": datetime.datetime.now(datetime.timezone.utc)
            .isoformat(timespec="seconds").replace("+00:00", "Z"),
        "source": "postgres",
        "counts": {
            "rows": len(out_rows),
            "occupations": len(occ_codes),
            "areas": len(area_codes),
            "industries": len(ind_codes),
        },
        "areas": [{"c": c, "n": areas[c]} for c in area_codes],
        "occupations": [{"c": c, "n": occupations[c]} for c in occ_codes],
        "industries": [{"c": c, "n": industries[c]} for c in ind_codes],
        "rows": out_rows,
        "map": area_map,
    }


def main():
    parser = argparse.ArgumentParser(
        description="Export slim offline catalog JSON from local Postgres.")
    repo_root = Path(__file__).resolve().parent.parent.parent
    parser.add_argument("--out", default=str(
        repo_root / "client" / "assets" / "data" / "catalog.v1.json"))
    parser.add_argument("--include-metros", action="store_true",
                        help="include metro-area career_roi rows "
                             "(excluded by default)")
    parser.add_argument("--areas", default=None,
                        help="CSV area-code allowlist overriding the default "
                             "feed set (implies full control, metros "
                             "included only if listed)")
    args = parser.parse_args()

    if args.areas is not None:
        wanted = [c.strip() for c in args.areas.split(",") if c.strip()]
        if not wanted:
            sys.exit("--areas must list at least one area code")
    elif args.include_metros:
        wanted = None
    else:
        wanted = list(FEED_AREA_CODES)
        print("  (excluding metro-area career_roi rows; "
              "--include-metros restores the full export)")

    where = None
    if wanted is not None:
        in_list = "(" + ",".join(f"'{c}'" for c in wanted) + ")"
        where = f"area_code IN {in_list}"

    conn = get_connection()
    conn.set_session(readonly=True)
    cursor = conn.cursor()
    rows = fetch_rows(cursor, where)
    aggregates = fetch_map(cursor, where)
    cursor.close()
    conn.close()

    catalog = build_catalog(rows, aggregates)
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(catalog, separators=(",", ":"))
    out_path.write_text(text + "\n", encoding="utf-8")

    size = len(text.encode("utf-8"))
    n = catalog["counts"]["rows"]
    print(f"Wrote {out_path} ({n} rows)")
    print(f"Size report: {size} bytes ({size / 1024:.1f} KB); "
          f"{size / n:.0f} bytes/row" if n else "Size report: empty export")


if __name__ == "__main__":
    main()
