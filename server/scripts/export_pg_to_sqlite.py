#!/usr/bin/env python3
"""Export the minimal API serving set from Postgres to D1-importable SQL.

The Cloudflare Worker (Hono + D1/SQLite) only serves 5 tables; the raw ETL
tables (salaries, ipeds_*, onet_*, bls_*, crosswalks, projections, ...) stay
in Postgres/the data pipeline and are NOT migrated:

  career_roi, career_contents, salary_occupations, career_images, swipes

Usage:
    python scripts/export_pg_to_sqlite.py --out export [--chunk-rows 4000]

    DATABASE_URL=postgres://... python scripts/export_pg_to_sqlite.py

Output: export/chunk_0001.sql ... plus export/counts.json with per-table
row counts for verification after import (see scripts/import_to_d1.sh).

Each chunk is one transaction of multi-row INSERTs sized to stay under D1's
per-statement limits: at most 300 rows / 96 KB per INSERT (the local D1 runner rejects
statements above ~100 KB / ~10k bound parameters; career_roi has
21 columns) with the byte budget as a second guard for text-heavy tables for text-heavy tables. Types map Postgres ->
SQLite: JSONB -> JSON text, timestamptz/timestamps -> ISO-8601 UTC
'YYYY-MM-DDTHH:MM:SS.sssZ' (matching the Worker's toISOString output and
the old Rails JSON shape), bool -> 0/1.
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

TABLES = [
    "career_roi",
    "career_contents",
    "salary_occupations",
    "career_images",
    "swipes",
]


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


def sql_literal(value):
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, (int, float)):
        return repr(value)
    if isinstance(value, datetime.datetime):
        # Match the Worker/Rails JSON shape: UTC ISO-8601 with milliseconds.
        dt = value
        if dt.tzinfo is not None:
            dt = dt.astimezone(datetime.timezone.utc).replace(tzinfo=None)
        return "'" + dt.isoformat(sep="T", timespec="milliseconds") + "Z" + "'"
    if isinstance(value, datetime.date):
        return "'" + value.isoformat() + "'"
    if isinstance(value, (dict, list)):
        return sql_literal(json.dumps(value))
    if isinstance(value, (bytes, bytearray, memoryview)):
        return "NULL"
    return "'" + str(value).replace("'", "''") + "'"


def export_table(cursor, table, out_dir, chunk_rows, chunk_bytes, counts, chunk_index):
    cursor.execute(f"SELECT * FROM {table} ORDER BY 1")
    columns = [d.name for d in cursor.description]
    col_list = ", ".join(f'"{c}"' for c in columns)
    rows_exported = 0
    batch = []
    batch_bytes = 0

    def flush():
        nonlocal chunk_index, batch, batch_bytes
        values = ",\n".join(batch)
        chunk_index += 1
        path = out_dir / f"chunk_{chunk_index:04d}_{table}.sql"
        path.write_text(
            f"INSERT INTO \"{table}\" ({col_list}) VALUES\n{values};\n"
        )
        batch = []
        batch_bytes = 0

    while True:
        rows = cursor.fetchmany(chunk_rows)
        if not rows:
            break
        for row in rows:
            if len(batch) >= chunk_rows:
                flush()
            text = "(" + ", ".join(sql_literal(v) for v in row) + ")"
            # Split text-heavy tables (e.g. career_contents) by statement size
            # so no single INSERT exceeds D1's per-statement limit.
            if batch and batch_bytes + len(text.encode("utf-8")) > chunk_bytes:
                flush()
            batch.append(text)
            batch_bytes += len(text.encode("utf-8")) + 2
            rows_exported += 1
    if batch:
        flush()
    counts[table] = rows_exported
    print(f"  {table}: {rows_exported} rows")
    return chunk_index


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="export")
    parser.add_argument("--chunk-rows", type=int, default=300)
    parser.add_argument("--chunk-bytes", type=int, default=96_000)
    args = parser.parse_args()

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    # A re-run must describe one snapshot: drop stale chunks first so the
    # importer never executes a mix of old and new exports.
    for stale in sorted(out_dir.glob("chunk_*.sql")):
        stale.unlink()

    conn = get_connection()
    conn.set_session(readonly=True)
    cursor = conn.cursor()
    counts = {}
    chunk_index = 0
    print("Exporting minimal serving set:")
    for table in TABLES:
        chunk_index = export_table(
            cursor, table, out_dir, args.chunk_rows, args.chunk_bytes,
            counts, chunk_index,
        )
    (out_dir / "counts.json").write_text(json.dumps(counts, indent=2) + "\n")
    print(f"Wrote {(out_dir / 'counts.json')}")
    cursor.close()
    conn.close()


if __name__ == "__main__":
    main()
