#!/usr/bin/env python3
"""Backfill career_contents for occupations missing them, via direct lookups.

The paginated ROI feed excludes most rows from some sorts and shuffles ties,
so bulk harvesting can miss occupations. This script checks every occupation
in salary_occupations exactly once (area 99; content is per-occupation) and
emits INSERT chunks only for occupations that have content and aren't
already in D1.

Usage:
  python scripts/backfill_contents.py --base https://careerality.app \
      --out /tmp/export_contents_new --start-id 641
  ./scripts/import_to_d1.sh /tmp/export_contents_new --remote   # with FORCE=1 (table non-empty)
"""

import argparse
import datetime
import json
import time
import urllib.request
from pathlib import Path

CHUNK_ROWS = 100
COLUMNS = [
    "id", "occupation_code", "day_in_life_summary", "day_in_life_full",
    "video_url", "created_at", "updated_at",
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


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default="https://careerality.app")
    parser.add_argument("--out", required=True)
    parser.add_argument("--start-id", type=int, required=True)
    parser.add_argument("--have", default="",
                        help="comma-separated occupation codes already imported (skipped)")
    args = parser.parse_args()

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    for stale in sorted(out_dir.glob("chunk_*.sql")):
        stale.unlink()

    have = set(c for c in args.have.split(",") if c)
    stamp = (
        datetime.datetime.now(datetime.timezone.utc)
        .isoformat(sep="T", timespec="milliseconds")
        .replace("+00:00", "Z")
    )

    # Full occupation directory (10 per page).
    codes = []
    page = 1
    while True:
        data = get_json(f"{args.base}/api/careers?page={page}")
        for c in data.get("careers", []):
            codes.append(c["code"])
        if page >= (data.get("pagy", {}).get("pages") or 1):
            break
        page += 1
        time.sleep(0.05)
    print(f"occupations: {len(codes)}, already have: {len(have)}")

    batch, batches, content_id, added = [], [], args.start_id - 1, 0
    for code in codes:
        if code in have:
            continue
        try:
            r = get_json(f"{args.base}/api/roi/{code}?area=99")
        except Exception as e:
            print(f"  skip {code}: {e}")
            continue
        if "day_in_life_summary" not in r:
            continue
        content_id += 1
        batch.append(
            "(" + ", ".join(sql_literal(v) for v in [
                content_id,
                r.get("occupation_code"),
                r.get("day_in_life_summary"),
                r.get("day_in_life_full"),
                r.get("video_url"),
                stamp,
                stamp,
            ]) + ")"
        )
        added += 1
        if len(batch) >= CHUNK_ROWS:
            batches.append(batch)
            batch = []
        time.sleep(0.05)

    if batch:
        batches.append(batch)
    for i, b in enumerate(batches, 1):
        cols = ", ".join(f'"{c}"' for c in COLUMNS)
        (out_dir / f"chunk_{i:04d}_career_contents.sql").write_text(
            f'INSERT INTO "career_contents" ({cols}) VALUES\n' + ",\n".join(b) + ";\n"
        )
    (out_dir / "counts.json").write_text(
        json.dumps({"career_contents_new": added}, indent=2) + "\n"
    )
    print(f"Done: {added} new content rows in {len(batches)} chunk(s)")


if __name__ == "__main__":
    main()
