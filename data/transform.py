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

def get_occupation_education_level(occ_code):
    onet_code = occ_code if '.' in occ_code else f"{occ_code[:2]}.{occ_code[2:]}"
    
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            SELECT data->>'Category' as category
            FROM onet_data
            WHERE data_type = 'education_experience'
              AND data->>'O*NET-SOC Code' LIKE %s
              AND data->>'Element ID' = '2.D.1'
            ORDER BY (data->>'Data Value')::NUMERIC DESC
            LIMIT 1
        """, (onet_code + '%',))
        
        result = cursor.fetchone()
        if result and result[0]:
            return result[0]
        return None
    finally:
        cursor.close()
        conn.close()


def get_tuition_by_education_level(education_category):
    import os
    import pandas as pd
    
    years_map = {
        1: 1,   # Less than high school
        2: 2,   # High school
        3: 2,   # Post-high school certificate
        4: 2,   # Some college
        5: 4,   # Associate's degree
        6: 4,   # Bachelor's degree
        7: 6,   # Master's degree
        8: 8,   # Doctoral degree
        9: 8,   # Professional degree
        10: 6,  # First professional degree
        11: 8,  # Doctoral degree
        12: 10, # Post-doctoral training
    }
    
    cat_int = int(float(education_category)) if education_category else 4
    years = years_map.get(cat_int, 4)
    
    base_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ic_path = os.path.join(base_path, 'data', 'education', 'IC2023.csv')
    cost_path = os.path.join(base_path, 'data', 'education', 'COST1_2024.csv')
    
    target_level = 1 if cat_int >= 5 else (2 if cat_int == 5 else 3)
    
    try:
        ic_df = pd.read_csv(ic_path, usecols=['UNITID', 'LEVEL1', 'LEVEL2', 'LEVEL3'], low_memory=False)
        ic_df['UNITID'] = pd.to_numeric(ic_df['UNITID'], errors='coerce')
        ic_df['LEVEL1'] = pd.to_numeric(ic_df['LEVEL1'], errors='coerce').fillna(0)
        ic_df['LEVEL2'] = pd.to_numeric(ic_df['LEVEL2'], errors='coerce').fillna(0)
        ic_df['LEVEL3'] = pd.to_numeric(ic_df['LEVEL3'], errors='coerce').fillna(0)
        
        def get_iclevel(row):
            if row['LEVEL1'] > 0:
                return 1
            elif row['LEVEL2'] > 0:
                return 2
            else:
                return 3
        
        ic_df['iclevel'] = ic_df.apply(get_iclevel, axis=1)
        level_unitids = set(ic_df[ic_df['iclevel'] == target_level]['UNITID'].dropna())
        
        cost_df = pd.read_csv(cost_path, usecols=['UNITID', 'TUITION1', 'TUITION2', 'TUITION3', 'HRCHG1', 'HRCHG2'], low_memory=False)
        cost_df['UNITID'] = pd.to_numeric(cost_df['UNITID'], errors='coerce')
        cost_df['TUITION1'] = pd.to_numeric(cost_df['TUITION1'], errors='coerce').fillna(0)
        cost_df = cost_df[cost_df['UNITID'].isin(level_unitids)]
        cost_df = cost_df[cost_df['TUITION1'] > 0]
        
        if len(cost_df) > 0:
            avg_tuition = cost_df['TUITION1'].mean()
        else:
            avg_tuition = 25000
        
    except Exception as e:
        avg_tuition = 25000
    
    return avg_tuition * years


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
    
    log("  Loading education levels from O*NET...")
    education_cache = {}
    cursor.execute("""
        SELECT DISTINCT ON (data->>'O*NET-SOC Code')
            data->>'O*NET-SOC Code' as onet_code,
            data->>'Category' as category
        FROM onet_data
        WHERE data_type = 'education_experience'
          AND data->>'Element ID' = '2.D.1'
          AND (data->>'Data Value')::NUMERIC > 0
        ORDER BY data->>'O*NET-SOC Code', (data->>'Data Value')::NUMERIC DESC
    """)
    for row in cursor.fetchall():
        if row[0]:
            education_cache[row[0]] = row[1]
    
    log("  Loading average tuition costs from IPEDS...")
    tuition_by_level = {}
    for cat in ['1', '2', '3', '4', '5', '6', '7', '8', '9']:
        tuition_by_level[cat] = get_tuition_by_education_level(cat)
    
    default_tuition = sum(tuition_by_level.values()) / len(tuition_by_level) if tuition_by_level else 30000

    values = []
    processed = 0
    for row in rows:
        occ_code, occ_title, area_code, area_title, industry_code, industry_name, annual_median, annual_mean, hourly_median, employment, year = row

        if not annual_median:
            continue

        processed += 1
        occ_name = occ_title or f"Code: {occ_code}"
        area_name = area_title or "Unknown Area"
        
        if '.' in occ_code:
            onet_code = occ_code
        elif '-' in occ_code:
            onet_code = f"{occ_code}.00"
        else:
            onet_code = f"{occ_code[:2]}-{occ_code[2:6]}.00"
        
        education_category = education_cache.get(onet_code)
        cat_int = int(float(education_category)) if education_category else 4
        
        years_map = {
            1: 'Less than high school',
            2: 'High school diploma',
            3: 'Postsecondary certificate',
            4: 'Some college',
            5: "Associate's degree",
            6: "Bachelor's degree",
            7: "Master's degree",
            8: 'Doctoral degree',
            9: 'Professional degree',
            10: 'First professional degree',
            11: 'Doctoral degree',
            12: 'Post-doctoral training',
        }
        
        job_zone = None
        if occ_code and occ_code.startswith('15'):
            job_zone = 4
        elif occ_code and occ_code.startswith('17'):
            job_zone = 4
        elif occ_code and occ_code.startswith('19'):
            job_zone = 5
        elif occ_code and occ_code.startswith('29'):
            job_zone = 5
        elif occ_code and occ_code.startswith('23'):
            job_zone = 5
        elif occ_code and occ_code.startswith('25'):
            job_zone = 3
        elif occ_code and occ_code.startswith('33'):
            job_zone = 2
        elif occ_code and occ_code.startswith('35'):
            job_zone = 2
        elif occ_code and occ_code.startswith('47'):
            job_zone = 2
        elif occ_code and occ_code.startswith('49'):
            job_zone = 2
        elif occ_code and occ_code.startswith('51'):
            job_zone = 2
        
        edu_cost = tuition_by_level.get(str(cat_int), default_tuition)
        education_level = years_map.get(cat_int, 'varies')

        annual_median_float = float(annual_median) if annual_median else 0
        
        if annual_median_float > 0 and edu_cost > 0:
            years_to_breakeven = int(edu_cost / annual_median_float)
        else:
            years_to_breakeven = 0

        roi_pct = ((annual_median_float * 10 - edu_cost) / edu_cost * 100) if edu_cost > 0 else 0

        col_index = 100.0
        adjusted_salary = annual_median_float

        values.append((
            occ_code,
            occ_name,
            area_code,
            area_name,
            industry_code,
            industry_name,
            annual_median,
            float(edu_cost),
            int(years_to_breakeven),
            float(roi_pct),
            job_zone,
            education_level,
            None,
            float(col_index),
            float(adjusted_salary)
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
    log(f"  Calculated ROI for {len(values)} careers (from {processed} salary records)")

def main():
    log("=" * 60)
    log("Transforming data into integrated tables")
    log("=" * 60)
    log("")

    transform_career_profiles()
    log("")

    transform_career_salaries()
    log("")

    transform_cost_of_living()
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
