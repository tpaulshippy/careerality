#!/usr/bin/env bash
# Import the minimal serving set into D1 and verify row counts.
#
# Usage:
#   ./scripts/import_to_d1.sh export [--local|--remote]
#
# 1. Applies migrations/0001_init.sql (no-op if tables exist — D1/Wrangler
#    tracks applied migrations, so run this only for a fresh DB).
# 2. Executes every chunk_*.sql from the export dir in filename order.
# 3. Compares D1 counts against export/counts.json.
#
# Prerequisites: wrangler authenticated, database_id set in wrangler.toml,
# export/ produced by scripts/export_pg_to_sqlite.py.

set -euo pipefail

EXPORT_DIR="${1:-export}"
TARGET="${2:---remote}"

if [ ! -f "$EXPORT_DIR/counts.json" ]; then
  echo "Missing $EXPORT_DIR/counts.json — run export_pg_to_sqlite.py first." >&2
  exit 1
fi

echo "== importing chunks into D1 ($TARGET)"
for f in "$EXPORT_DIR"/chunk_*.sql; do
  echo "-- $f"
  npx wrangler d1 execute careerality "$TARGET" --file "$f" --json | tail -1
done

echo "== verifying counts"
python3 - "$EXPORT_DIR/counts.json" "$TARGET" <<'EOF'
import json, subprocess, sys

counts_path, target = sys.argv[1], sys.argv[2]
expected = json.load(open(counts_path))
failed = False
for table, want in expected.items():
    out = subprocess.run(
        ["npx", "wrangler", "d1", "execute", "careerality", target,
         "--command", f'SELECT COUNT(*) AS n FROM "{table}"', "--json"],
        capture_output=True, text=True, check=True,
    )
    got = json.loads(out.stdout)[0]["results"][0]["n"]
    status = "OK " if got == want else "MISMATCH"
    if got != want:
        failed = True
    print(f"[{status}] {table}: D1={got} expected={want}")
sys.exit(1 if failed else 0)
EOF
