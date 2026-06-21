#!/usr/bin/env python3
"""One-off backfill of career_roi demand fields from state_high_demand_careers.

Mirrors the demand_score calculation in transform_career_roi so the demand sort
works without a full ETL re-run. Run once after state_high_demand_careers is
populated:

    python data/backfill_career_roi_demand.py
"""

import sys
import psycopg2

DB_CONFIG = {
    'dbname': 'careerality',
    'user': 'postgres',
    'password': 'postgres',
    'host': 'localhost'
}


def log(msg):
    print(msg)
    sys.stdout.flush()


def get_connection():
    return psycopg2.connect(**DB_CONFIG)


BACKFILL_SQL = """
    UPDATE career_roi
    SET demand_rank = s.rank,
        avg_annual_openings = s.avg_annual_openings,
        projected_growth_percent = s.percent_change,
        demand_score = CASE
          WHEN s.rank IS NOT NULL OR s.percent_change IS NOT NULL THEN
            (CASE WHEN s.rank IS NOT NULL AND s.rank <> 0 THEN (1.0 / s.rank) * 0.5 ELSE 0 END)
            + (CASE WHEN s.percent_change IS NOT NULL AND s.percent_change <> 0
                    THEN (s.percent_change / 100.0) * 0.3 ELSE 0 END)
          ELSE NULL
        END,
        updated_at = NOW()
    FROM (
      SELECT DISTINCT ON (state_fips, occ_code)
        state_fips, occ_code, rank, avg_annual_openings, percent_change
      FROM state_high_demand_careers
      WHERE demand_metric = 'percent_change'
      ORDER BY state_fips, occ_code, projection_type
    ) s
    WHERE s.occ_code = career_roi.occupation_code
      AND s.state_fips = CASE WHEN career_roi.area_code = '99' THEN '00'
                              WHEN career_roi.area_code ~ '^[0-9]{1,2}$'
                                THEN LPAD(career_roi.area_code, 2, '0')
                              ELSE NULL END
"""


def main():
    log("Backfilling career_roi demand fields from state_high_demand_careers...")
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(BACKFILL_SQL)
        updated = cursor.rowcount
        conn.commit()
        log(f"  Updated {updated} career_roi rows")
    finally:
        cursor.close()
        conn.close()
    log("Done.")


if __name__ == '__main__':
    main()
