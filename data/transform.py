#!/usr/bin/env python3

import json
import sys
import psycopg2
from psycopg2.extras import execute_batch

def log(msg):
    print(msg)
    sys.stdout.flush()

DB_CONFIG = {
    'dbname': 'careerality',
    'user': 'postgres',
    'password': 'postgres',
    'host': 'localhost'
}

def get_connection():
    return psycopg2.connect(**DB_CONFIG)

def create_tables():
    log("Creating new tables (if not exists)...")
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'career_roi'
    """)
    rails_managed = cursor.fetchone() is not None

    if not rails_managed:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS career_profiles (
                id SERIAL PRIMARY KEY,
                occupation_code VARCHAR(20) UNIQUE,
                occupation_name VARCHAR(255),
                occupation_description TEXT,
                onet_data JSONB,
                job_zone INTEGER,
                education_level VARCHAR(50),
                experience_required VARCHAR(50),
                skills JSONB,
                tasks JSONB,
                work_activities JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS career_salaries (
                id SERIAL PRIMARY KEY,
                occupation_code VARCHAR(20),
                area_code VARCHAR(10),
                year INTEGER,
                hourly_mean_wage NUMERIC,
                annual_mean_wage NUMERIC,
                hourly_median_wage NUMERIC,
                annual_median_wage NUMERIC,
                hourly_10th_percentile NUMERIC,
                hourly_25th_percentile NUMERIC,
                hourly_75th_percentile NUMERIC,
                hourly_90th_percentile NUMERIC,
                annual_10th_percentile NUMERIC,
                annual_25th_percentile NUMERIC,
                annual_75th_percentile NUMERIC,
                annual_90th_percentile NUMERIC,
                employment INTEGER,
                location_quotient NUMERIC,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(occupation_code, area_code, year)
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS career_education_costs (
                id SERIAL PRIMARY KEY,
                occupation_code VARCHAR(20),
                unitid INTEGER,
                institution_name VARCHAR(255),
                program_length_years NUMERIC,
                tuition_in_state NUMERIC,
                tuition_out_of_state NUMERIC,
                fees NUMERIC,
                room_and_board NUMERIC,
                books_and_supplies NUMERIC,
                other_costs NUMERIC,
                total_cost NUMERIC,
                financial_aid JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS career_cost_of_living (
                id SERIAL PRIMARY KEY,
                area_code VARCHAR(10),
                area_name VARCHAR(255),
                col_index NUMERIC,
                grocery_index NUMERIC,
                housing_index NUMERIC,
                utilities_index NUMERIC,
                transportation_index NUMERIC,
                misc_index NUMERIC,
                year INTEGER,
                quarter INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(area_code, year, quarter)
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS career_roi (
                id SERIAL PRIMARY KEY,
                occupation_code VARCHAR(20),
                occupation_name VARCHAR(255),
                area_code VARCHAR(10),
                area_name VARCHAR(255),
                industry_code VARCHAR(50),
                industry_name VARCHAR(255),
                annual_median_salary NUMERIC,
                education_cost NUMERIC,
                years_to_breakeven INTEGER,
                roi_percentage NUMERIC,
                job_zone INTEGER,
                education_level VARCHAR(50),
                skills JSONB,
                cost_of_living_index NUMERIC,
                adjusted_salary NUMERIC,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(occupation_code, area_code, industry_code)
            )
        """)
        conn.commit()
        cursor.close()
        conn.close()
        log("  Tables created successfully!")
    else:
        cursor.close()
        conn.close()
        log("  Tables managed by Rails migration - skipping creation")

def transform_career_profiles():
    log("Transforming career profiles...")
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("DELETE FROM career_profiles")
    conn.commit()

    cursor.execute("""
        SELECT occupation_code, occupation_name, occupation_description
        FROM salary_occupations
        WHERE selectable = 'T' AND display_level >= 1
        ORDER BY occupation_code
    """)
    occupations = cursor.fetchall()

    values = []
    for occ_code, occ_name, occ_desc in occupations:
        values.append((
            occ_code,
            occ_name,
            occ_desc,
            None,
            None,
            None,
            None,
            "[]",
            "[]",
            "[]"
        ))

    query = """
        INSERT INTO career_profiles 
        (occupation_code, occupation_name, occupation_description, onet_data, job_zone, 
         education_level, experience_required, skills, tasks, work_activities)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (occupation_code) DO NOTHING
    """
    execute_batch(cursor, query, values)
    conn.commit()

    cursor.close()
    conn.close()
    log(f"  Transformed {len(values)} career profiles")

def transform_career_salaries():
    log("Transforming career salaries...")
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("DELETE FROM career_salaries")
    conn.commit()

    national_area = "99"

    cursor.execute("""
        SELECT 
            s.occ_code,
            s.area,
            s.year,
            s.h_mean as hourly_mean_wage,
            s.a_mean as annual_mean_wage,
            s.h_median as hourly_median_wage,
            s.a_median as annual_median_wage,
            s.h_pct10 as hourly_10th,
            s.h_pct25 as hourly_25th,
            s.h_pct75 as hourly_75th,
            s.h_pct90 as hourly_90th,
            s.a_pct10 as annual_10th,
            s.a_pct25 as annual_25th,
            s.a_pct75 as annual_75th,
            s.a_pct90 as annual_90th,
            s.tot_emp as employment,
            s.loc_quotient as location_quotient
        FROM salaries s
        WHERE s.occ_code IS NOT NULL 
          AND s.occ_code != '0'
          AND s.area = %s
          AND s.year = (SELECT MAX(year) FROM salaries WHERE area = %s)
          AND s.a_median IS NOT NULL
    """, (national_area, national_area))

    rows = cursor.fetchall()

    values = []
    for row in rows:
        values.append((
            row[0], row[1], row[2], row[3], row[4], row[5], row[6],
            row[7], row[8], row[9], row[10], row[11], row[12], row[13],
            row[14], row[15], row[16]
        ))

    query = """
        INSERT INTO career_salaries 
        (occupation_code, area_code, year, hourly_mean_wage, annual_mean_wage, 
         hourly_median_wage, annual_median_wage, hourly_10th_percentile, 
         hourly_25th_percentile, hourly_75th_percentile, hourly_90th_percentile,
         annual_10th_percentile, annual_25th_percentile, annual_75th_percentile,
         annual_90th_percentile, employment, location_quotient)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (occupation_code, area_code, year) DO NOTHING
    """

    if values:
        execute_batch(cursor, query, values)
        conn.commit()

    cursor.close()
    conn.close()
    log(f"  Transformed {len(values)} salary records")

def transform_cost_of_living():
    log("Transforming cost of living data...")
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("DELETE FROM career_cost_of_living")
    conn.commit()

    national_col_index = 100.0

    values = []
    values.append((
        "0000000",
        "National Average",
        national_col_index,
        national_col_index,
        national_col_index,
        national_col_index,
        national_col_index,
        national_col_index,
        2026,
        1
    ))

    query = """
        INSERT INTO career_cost_of_living 
        (area_code, area_name, col_index, grocery_index, housing_index, 
         utilities_index, transportation_index, misc_index, year, quarter)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (area_code, year, quarter) DO NOTHING
    """

    execute_batch(cursor, query, values)
    conn.commit()

    cursor.close()
    conn.close()
    log(f"  Transformed {len(values)} cost of living records")

def transform_education_costs():
    log("Transforming education costs...")
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("DELETE FROM career_education_costs")
    conn.commit()

    cursor.execute("""
        SELECT id, unitid, data
        FROM student_financial_aid
        WHERE data->>'TUITIONFEE_IN' IS NOT NULL 
           OR data->>'TUITIONFEE_OUT' IS NOT NULL
        LIMIT 1000
    """)
    rows = cursor.fetchall()

    values = []
    for row_id, unitid, data in rows:
        tuition_in = data.get('TUITIONFEE_IN')
        tuition_out = data.get('TUITIONFEE_OUT')
        fees = data.get('TUITIONFEE')
        room = data.get('ROOMBOARD_OFFC') or data.get('ROOMBOARD_ON')
        books = data.get('BOOKSUPPLY')
        
        institution_name = data.get('INSTNM', 'Unknown Institution')
        total_cost = data.get('COSTT4')

        values.append((
            None,
            unitid,
            institution_name,
            4,
            tuition_in,
            tuition_out,
            fees,
            room,
            books,
            None,
            total_cost,
            json.dumps(data)
        ))

    query = """
        INSERT INTO career_education_costs 
        (occupation_code, unitid, institution_name, program_length_years,
         tuition_in_state, tuition_out_of_state, fees, room_and_board, 
         books_and_supplies, other_costs, total_cost, financial_aid)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """

    if values:
        execute_batch(cursor, query, values)
        conn.commit()

    cursor.close()
    conn.close()
    log(f"  Transformed {len(values)} education cost records")

def transform_career_roi():
    log("Calculating career ROI...")
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("DELETE FROM career_roi")
    conn.commit()

    cursor.execute("""
        SELECT DISTINCT ON (s.occ_code, s.area, s.i_group)
            s.occ_code as occ_code,
            s.occ_title as occ_title,
            s.area as area_code,
            s.area_title as area_title,
            s.i_group as industry_code,
            s.i_group as industry_name,
            s.a_median as annual_median_wage,
            s.a_mean as annual_mean_wage,
            s.h_median as hourly_median_wage,
            s.tot_emp as employment,
            s.year
        FROM salaries s
        WHERE s.area IS NOT NULL
          AND s.area != '0'
          AND s.i_group IS NOT NULL
          AND s.a_median IS NOT NULL
          AND s.occ_code IS NOT NULL
          AND s.occ_code != '0'
        ORDER BY s.occ_code, s.area, s.i_group, s.a_median DESC
    """)

    rows = cursor.fetchall()

    values = []
    for row in rows:
        occ_code, occ_title, area_code, area_title, industry_code, industry_name, annual_median, annual_mean, hourly_median, employment, year = row

        if not annual_median:
            continue

        occ_name = occ_title or f"Code: {occ_code}"
        area_name = area_title or "Unknown Area"
        job_zone = None
        edu_cost = 20000

        if occ_code and occ_code.startswith('15'):
            job_zone = 4
            edu_cost = 60000
        elif occ_code and occ_code.startswith('17'):
            job_zone = 4
            edu_cost = 60000
        elif occ_code and occ_code.startswith('19'):
            job_zone = 5
            edu_cost = 150000
        elif occ_code and occ_code.startswith('29'):
            job_zone = 5
            edu_cost = 150000
        elif occ_code and occ_code.startswith('23'):
            job_zone = 5
            edu_cost = 150000
        elif occ_code and occ_code.startswith('25'):
            job_zone = 3
            edu_cost = 35000
        elif occ_code and occ_code.startswith('33'):
            job_zone = 2
            edu_cost = 10000
        elif occ_code and occ_code.startswith('35'):
            job_zone = 2
            edu_cost = 10000
        elif occ_code and occ_code.startswith('47'):
            job_zone = 2
            edu_cost = 15000
        elif occ_code and occ_code.startswith('49'):
            job_zone = 2
            edu_cost = 15000
        elif occ_code and occ_code.startswith('51'):
            job_zone = 2
            edu_cost = 15000

        if annual_median > 0 and edu_cost > 0:
            years_to_breakeven = int(edu_cost / annual_median) if annual_median > 0 else 0
        else:
            years_to_breakeven = 0

        roi_pct = ((annual_median * 10 - edu_cost) / edu_cost * 100) if edu_cost > 0 else 0

        col_index = 100.0
        adjusted_salary = annual_median

        values.append((
            occ_code,
            occ_name,
            area_code,
            area_name,
            industry_code,
            industry_name,
            annual_median,
            edu_cost,
            years_to_breakeven,
            roi_pct,
            job_zone,
            "varies",
            None,
            col_index,
            adjusted_salary
        ))

    query = """
        INSERT INTO career_roi 
        (occupation_code, occupation_name, area_code, area_name, industry_code, industry_name,
         annual_median_salary, education_cost, years_to_breakeven, roi_percentage, job_zone, 
         education_level, skills, cost_of_living_index, adjusted_salary, created_at, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
        ON CONFLICT (occupation_code, area_code, industry_code) DO NOTHING
    """

    if values:
        execute_batch(cursor, query, values)
        conn.commit()

    cursor.close()
    conn.close()
    log(f"  Calculated ROI for {len(values)} careers")

def main():
    log("=" * 60)
    log("Transforming data into integrated tables")
    log("=" * 60)
    log("")

    create_tables()
    log("")

    transform_career_profiles()
    log("")

    transform_career_salaries()
    log("")

    transform_cost_of_living()
    log("")

    transform_education_costs()
    log("")

    transform_career_roi()
    log("")

    log("=" * 60)
    log("Transformation complete!")
    log("=" * 60)

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT 'career_profiles' as table_name, COUNT(*) FROM career_profiles
        UNION ALL SELECT 'career_salaries', COUNT(*) FROM career_salaries
        UNION ALL SELECT 'career_education_costs', COUNT(*) FROM career_education_costs
        UNION ALL SELECT 'career_cost_of_living', COUNT(*) FROM career_cost_of_living
        UNION ALL SELECT 'career_roi', COUNT(*) FROM career_roi
    """)
    log("\nTable summary:")
    for row in cursor.fetchall():
        log(f"  {row[0]}: {row[1]} rows")
    cursor.close()
    conn.close()

if __name__ == '__main__':
    main()
