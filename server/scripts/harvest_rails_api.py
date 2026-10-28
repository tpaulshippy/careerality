#!/usr/bin/env python3
"""Harvest the serving dataset from the production Rails API into D1-importable SQL.

Used when the Postgres source is unreachable but the Rails API is still
serving: it paginates the public read endpoints and rebuilds the minimal
serving set (career_roi, career_contents, salary_occupations) exactly as the
API serves it — including prod `id` values so a later swipe migration keeps
working `career_id` references.

Swipes CANNOT be harvested (per-user); migrate those from Postgres at cutover.

Usage:
    python scripts/harvest_rails_api.py --base https://careerality.app --out export_prod

Output: chunk_*.sql + counts.json, importable with scripts/import_to_d1.sh.
"""

import argparse
import datetime
import json
import sys
import time
import urllib.request
from pathlib import Path

CHUNK_ROWS = 300
CHUNK_BYTES = 96_000
ROI_COLUMNS = [
    "id", "occupation_code", "occupation_name", "area_code", "area_name",
    "annual_median_salary", "education_cost", "years_to_breakeven",
    "roi_percentage", "job_zone", "education_level", "skills",
    "cost_of_living_index", "adjusted_salary", "industry_code",
    "industry_name", "demand_rank", "avg_annual_openings",
    "projected_growth_percent", "demand_score", "created_at", "updated_at",
]
CONTENT_COLUMNS = [
    "id", "occupation_code", "day_in_life_summary", "day_in_life_full",
    "video_url", "created_at", "updated_at",
]
OCC_COLUMNS = [
    "occupation_code", "occupation_name", "occupation_description",
    "display_level", "selectable", "sort_sequence",
]


def sql_literal(value):
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, (int, float)):
        return repr(value)
    if isinstance(value, (dict, list)):
        return sql_literal(json.dumps(value))
    return "'" + str(value).replace("'", "''") + "'"


def get_json(url):
    req = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "Mozilla/5.0 (compatible; CareeralityDataHarvest/1.0)",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.load(res)


def paginate(base, path):
    page = 1
    while True:
        sep = "&" if "?" in path else "?"
        data = get_json(f"{base}{path}{sep}page={page}")
        records = data.get("records") or data.get("careers") or []
        if not records:
            return
        yield data
        total_pages = data.get("pagy", {}).get("pages") or 1
        if page >= total_pages:
            return
        page += 1
        time.sleep(0.05)


class Chunker:
    def __init__(self, out_dir, start_index=0):
        self.out_dir = out_dir
        self.index = start_index
        self.batch = []
        self.batch_bytes = 0

    def flush(self, table, cols):
        if not self.batch:
            return
        self.index += 1
        col_list = ", ".join(f'"{c}"' for c in cols)
        values = ",\n".join(self.batch)
        path = self.out_dir / f"chunk_{self.index:04d}_{table}.sql"
        path.write_text(f'INSERT INTO "{table}" ({col_list}) VALUES\n{values};\n')
        self.batch = []
        self.batch_bytes = 0

    def add(self, table, cols, row, counts):
        text = "(" + ", ".join(sql_literal(v) for v in row) + ")"
        if self.batch and (
            len(self.batch) >= CHUNK_ROWS
            or self.batch_bytes + len(text.encode()) > CHUNK_BYTES
        ):
            self.flush(table, cols)
        self.batch.append(text)
        self.batch_bytes += len(text.encode()) + 2
        counts[table] = counts.get(table, 0) + 1


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default="https://careerality.app")
    parser.add_argument("--out", default="export_prod")
    parser.add_argument("--sort", default="demand",
                        help="roi sort order to paginate (demand|roi|salary|breakeven); alternate sorts surface different tie rows")
    parser.add_argument(
        "--resume",
        action="store_true",
        help="append to an existing out dir, skipping ids in ids.json (repeat until a run adds 0 rows)",
    )
    args = parser.parse_args()

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    if not args.resume:
        for stale in sorted(out_dir.glob("chunk_*.sql")):
            stale.unlink()
        (out_dir / "ids.json").unlink(missing_ok=True)
    chunk_start = 0
    if args.resume:
        nums = [
            int(p.stem.split("_")[1])
            for p in out_dir.glob("chunk_*.sql")
            if p.stem.split("_")[1].isdigit()
        ]
        chunk_start = max(nums, default=0)

    stamp = (
        datetime.datetime.now(datetime.timezone.utc)
        .isoformat(sep="T", timespec="milliseconds")
        .replace("+00:00", "Z")
    )
    chunker_roi = Chunker(out_dir, start_index=chunk_start)
    chunker_contents = Chunker(out_dir, start_index=chunk_start)
    chunker_occ = Chunker(out_dir, start_index=chunk_start)
    if args.resume and (out_dir / "counts.json").exists():
        counts = json.loads((out_dir / "counts.json").read_text())
    else:
        counts = {}

    print("Harvesting career_roi (+ contents)...")
    content_id = 0
    seen_roi = set()
    seen_content = set()
    seen_occ = set()
    dupes = 0
    if args.resume and (out_dir / "ids.json").exists():
        saved = json.loads((out_dir / "ids.json").read_text())
        seen_roi = set(saved.get("roi", []))
        seen_content = set(saved.get("contents", []))
        seen_occ = set(saved.get("occ", []))
        # Content ids were assigned 1..N in order; continue the sequence.
        content_id = len(seen_content)
        content_id = len(seen_content)
    for data in paginate(args.base, f"/api/roi?sort={args.sort}"):
        for r in data.get("records", []):
            if r.get("id") in seen_roi:
                dupes += 1
                continue
            seen_roi.add(r.get("id"))
            row = [r.get(c) for c in ROI_COLUMNS if c not in ("created_at", "updated_at")]
            row += [stamp, stamp]
            chunker_roi.add("career_roi", ROI_COLUMNS, row, counts)
            if "day_in_life_summary" in r and r.get("occupation_code") not in seen_content:
                seen_content.add(r.get("occupation_code"))
                content_id += 1
                crow = [
                    content_id,
                    r.get("occupation_code"),
                    r.get("day_in_life_summary"),
                    r.get("day_in_life_full"),
                    r.get("video_url"),
                    stamp,
                    stamp,
                ]
                chunker_contents.add("career_contents", CONTENT_COLUMNS, crow, counts)
    chunker_roi.flush("career_roi", ROI_COLUMNS)
    chunker_contents.flush("career_contents", CONTENT_COLUMNS)

    print("Harvesting salary_occupations...")
    # Resuming continues numbering after already-harvested occupations.
    sort_sequence = len(seen_occ)
    for data in paginate(args.base, "/api/careers"):
        for c in data.get("careers", []):
            if c.get("code") in seen_occ:
                dupes += 1
                continue
            seen_occ.add(c.get("code"))
            sort_sequence += 1
            row = [
                c.get("code"),
                c.get("name"),
                c.get("description"),
                c.get("level"),
                "T",
                sort_sequence,
            ]
            chunker_occ.add("salary_occupations", OCC_COLUMNS, row, counts)
    chunker_occ.flush("salary_occupations", OCC_COLUMNS)

    (out_dir / "counts.json").write_text(json.dumps(counts, indent=2) + "\n")
    (out_dir / "ids.json").write_text(
        json.dumps(
            {
                "roi": sorted(seen_roi),
                "contents": sorted(seen_content),
                "occ": sorted(seen_occ),
            }
        )
        + "\n"
    )
    print(f"Done: {counts} (skipped {dupes} duplicate rows from unstable pages)")
    print("Import with: ./scripts/import_to_d1.sh", args.out, "--remote")


if __name__ == "__main__":
    main()
