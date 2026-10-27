#!/usr/bin/env bash
# Import the minimal serving set into D1 and verify row counts.
#
# Usage:
#   ./scripts/import_to_d1.sh export [--local|--remote]
#   FORCE=1 ./scripts/import_to_d1.sh export --remote   # skip empty-table preflight
#
# 1. Applies pending D1 migrations (migrations/0001_init.sql on a fresh DB).
#    This is the only path that updates D1's migration bookkeeping — never
#    apply the schema with --file, or a later `migrations apply` will try to
#    recreate the tables.
# 2. Executes every chunk_*.sql from the export dir in filename order.
# 3. Compares D1 counts against export/counts.json.
#
# The import is not idempotent: a failed run leaves earlier chunks committed,
# so the script aborts unless every target table is empty. To retry, clear
# the tables first (child rows before parents) or recreate the database:
#
#   npx wrangler d1 execute careerality --remote --command \
#     "DELETE FROM swipes; DELETE FROM career_images; DELETE FROM career_contents; DELETE FROM salary_occupations; DELETE FROM career_roi;"
#
# ...or bypass the guard with FORCE=1.
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

TABLES="career_roi career_contents salary_occupations career_images swipes"

echo "== applying D1 migrations ($TARGET)"
npx wrangler d1 migrations apply careerality "$TARGET"

if [ "${FORCE:-0}" != "1" ]; then
  echo "== preflight: target tables must be empty"
  for table in $TABLES; do
    n=$(npx wrangler d1 execute careerality "$TARGET" \
      --command "SELECT COUNT(*) AS n FROM \"$table\"" --json \
      | python3 -c "import json,sys; print(json.load(sys.stdin)[0]['results'][0]['n'])")
    if [ "$n" != "0" ]; then
      echo "ABORT: \"$table\" already has $n rows. Clear it (see script header) or re-run with FORCE=1." >&2
      exit 1
    fi
  done
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
