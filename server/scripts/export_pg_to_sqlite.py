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
per-statement limits. Types map Postgres -> SQLite: JSONB -> JSON text,
timestamptz -> 'YYYY-MM-DD HH:MM:SS.ffffff' text, bool -> 0/1.
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
    if isinstance(value, (datetime.datetime, datetime.date)):
        return "'" + value.isoformat(sep=" ") + "'"
    if isinstance(value, (dict, list)):
        return sql_literal(json.dumps(value))
    if isinstance(value, (bytes, bytearray, memoryview)):
        return "NULL"
    return "'" + str(value).replace("'", "''") + "'"


def export_table(cursor, table, out_dir, chunk_rows, counts, chunk_index):
    cursor.execute(f"SELECT * FROM {table} ORDER BY 1")
    columns = [d.name for d in cursor.description]
    col_list = ", ".join(f'"{c}"' for c in columns)
    rows_exported = 0
    batch = []
    while True:
        rows = cursor.fetchmany(chunk_rows)
        if not rows:
            break
        values = ",\n".join(
            "(" + ", ".join(sql_literal(v) for v in row) + ")" for row in rows
        )
        chunk_index += 1
        path = out_dir / f"chunk_{chunk_index:04d}_{table}.sql"
        path.write_text(
            f"INSERT INTO \"{table}\" ({col_list}) VALUES\n{values};\n"
        )
        rows_exported += len(rows)
    counts[table] = rows_exported
    print(f"  {table}: {rows_exported} rows")
    return chunk_index


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="export")
    parser.add_argument("--chunk-rows", type=int, default=4000)
    args = parser.parse_args()

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    conn = get_connection()
    conn.set_session(readonly=True)
    cursor = conn.cursor()
    counts = {}
    chunk_index = 0
    print("Exporting minimal serving set:")
    for table in TABLES:
        chunk_index = export_table(
            cursor, table, out_dir, args.chunk_rows, counts, chunk_index
        )
    (out_dir / "counts.json").write_text(json.dumps(counts, indent=2) + "\n")
    print(f"Wrote {(out_dir / 'counts.json')}")
    cursor.close()
    conn.close()


if __name__ == "__main__":
    main()
