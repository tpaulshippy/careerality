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

    log("  Loading job zones from O*NET...")
    job_zone_cache = {}
    cursor.execute("""
        SELECT DISTINCT ON (data->>'O*NET-SOC Code')
            data->>'O*NET-SOC Code' as onet_code,
            data->>'Job Zone' as job_zone
        FROM onet_data
        WHERE data_type = 'job_zones'
          AND data->>'Job Zone' IS NOT NULL
        ORDER BY data->>'O*NET-SOC Code', (data->>'Job Zone')::NUMERIC ASC
    """)
    for row in cursor.fetchall():
        if row[0] and row[1]:
            job_zone_cache[row[0]] = int(row[1])
    log(f"    Loaded {len(job_zone_cache)} job zones")

    log("  Loading education levels from O*NET...")
    education_cache = {}
    cursor.execute("""
        SELECT DISTINCT ON (onet_soc_code)
            onet_soc_code,
            data_value_label
        FROM onet_education
        WHERE category = 1
        ORDER BY onet_soc_code, data_value DESC
    """)
    for row in cursor.fetchall():
        if row[0] and row[1]:
            education_cache[row[0]] = row[1]
    log(f"    Loaded {len(education_cache)} education levels")

    log("  Loading skills from O*NET...")
    skills_cache = {}
    cursor.execute("""
        SELECT DISTINCT ON (data->>'O*NET-SOC Code')
            data->>'O*NET-SOC Code' as onet_code,
            data->>'Element Name' as skill_name,
            (data->>'Data Value')::NUMERIC as skill_value
        FROM onet_data
        WHERE data_type = 'skills'
          AND data->>'Element Name' IS NOT NULL
        ORDER BY data->>'O*NET-SOC Code', (data->>'Data Value')::NUMERIC DESC
    """)
    for row in cursor.fetchall():
        onet_code, skill_name, skill_value = row
        if not onet_code or not skill_name:
            continue
        if onet_code not in skills_cache:
            skills_cache[onet_code] = []
        if len(skills_cache[onet_code]) < 15:
            skills_cache[onet_code].append(skill_name)
    log(f"    Loaded skills for {len(skills_cache)} occupations")

    log("  Loading tasks from O*NET...")
    tasks_cache = {}
    cursor.execute("""
        SELECT DISTINCT ON (data->>'O*NET-SOC Code')
            data->>'O*NET-SOC Code' as onet_code,
            data->>'Task' as task
        FROM onet_data
        WHERE data_type = 'tasks'
          AND data->>'Task' IS NOT NULL
        ORDER BY data->>'O*NET-SOC Code'
        LIMIT 50000
    """)
    for row in cursor.fetchall():
        onet_code, task = row
        if not onet_code or not task:
            continue
        if onet_code not in tasks_cache:
            tasks_cache[onet_code] = []
        if len(tasks_cache[onet_code]) < 10:
            tasks_cache[onet_code].append(task)
    log(f"    Loaded tasks for {len(tasks_cache)} occupations")

    log("  Loading work activities from O*NET...")
    activities_cache = {}
    cursor.execute("""
        SELECT DISTINCT ON (data->>'O*NET-SOC Code')
            data->>'O*NET-SOC Code' as onet_code,
            data->>'Element Name' as activity_name,
            (data->>'Data Value')::NUMERIC as activity_value
        FROM onet_data
        WHERE data_type = 'work_activities'
          AND data->>'Element Name' IS NOT NULL
        ORDER BY data->>'O*NET-SOC Code', (data->>'Data Value')::NUMERIC DESC
    """)
    for row in cursor.fetchall():
        onet_code, activity_name, activity_value = row
        if not onet_code or not activity_name:
            continue
        if onet_code not in activities_cache:
            activities_cache[onet_code] = []
        if len(activities_cache[onet_code]) < 10:
            activities_cache[onet_code].append(activity_name)
    log(f"    Loaded work activities for {len(activities_cache)} occupations")

    values = []
    for occ_code, occ_name, occ_desc in occupations:
        if '.' in occ_code:
            onet_code = occ_code
        elif '-' in occ_code:
            onet_code = f"{occ_code}.00"
        else:
            onet_code = f"{occ_code[:2]}-{occ_code[2:6]}.00"

        job_zone = job_zone_cache.get(onet_code)
        education_level = education_cache.get(onet_code)
        skills = json.dumps(skills_cache.get(onet_code, []))
        tasks = json.dumps(tasks_cache.get(onet_code, []))
        work_activities = json.dumps(activities_cache.get(onet_code, []))

        values.append((
            occ_code,
            occ_name,
            occ_desc,
            None,
            job_zone,
            education_level,
            None,
            skills,
            tasks,
            work_activities
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
    
    cursor.execute("SELECT MAX(year) FROM salaries WHERE area = %s", (national_area,))
    max_year = cursor.fetchone()[0]

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
          AND s.year = %s
          AND s.a_median IS NOT NULL
    """, (national_area, max_year))

    rows = cursor.fetchall()
    log(f"  Loading {len(rows)} national salary records")

    values = []
    for row in rows:
        values.append((
            row[0], row[1], row[2], row[3], row[4], row[5], row[6],
            row[7], row[8], row[9], row[10], row[11], row[12], row[13],
            row[14], row[15], row[16]
        ))
    
    cursor.execute("""
        SELECT MAX(year) FROM salaries WHERE area_type = 2
    """)
    max_state_year = cursor.fetchone()[0] or max_year
    
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
          AND s.area_type = 2
          AND s.year = %s
          AND s.a_median IS NOT NULL
    """, (max_state_year,))
    
    state_rows = cursor.fetchall()
    log(f"  Loading {len(state_rows)} state salary records")

    for row in state_rows:
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

    cursor.execute("SELECT area, col_index, grocery_index, housing_index, utilities_index, transportation_index, misc_index, year, quarter FROM cost_of_living")
    rows = cursor.fetchall()

    state_data = {}
    fips_to_state = {
        '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO', '09': 'CT', '10': 'DE',
        '11': 'DC', '12': 'FL', '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL', '18': 'IN', '19': 'IA',
        '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME', '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN',
        '28': 'MS', '29': 'MO', '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH', '34': 'NJ', '35': 'NM',
        '36': 'NY', '37': 'NC', '38': 'ND', '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI',
        '45': 'SC', '46': 'SD', '47': 'TN', '48': 'TX', '49': 'UT', '50': 'VT', '51': 'VA', '53': 'WA',
        '54': 'WV', '55': 'WI', '56': 'WY', '72': 'PR'
    }

    for row in rows:
        area = row[0]
        if not area:
            continue

        area_lower = area.lower().strip()

        state_code = None
        if len(area) == 2 and area.isupper() and area in fips_to_state.values():
            state_code = area
        elif area_lower in ['united states', 'national', 'national average', 'us average']:
            state_code = '00'
        else:
            for fips, state in fips_to_state.items():
                if fips in area or state.lower() in area_lower or area_lower.endswith(f' {state.lower()}') or area_lower.endswith(f', {state.lower()}'):
                    state_code = fips
                    break
            if not state_code and '(' in area:
                abbrev = area.split('(')[-1].strip().replace(')', '').strip()
                if abbrev in fips_to_state.values():
                    state_code = [k for k, v in fips_to_state.items() if v == abbrev][0] if [k for k, v in fips_to_state.items() if v == abbrev] else None

        if state_code:
            if state_code not in state_data:
                state_data[state_code] = {'col_index': [], 'grocery_index': [], 'housing_index': [], 'utilities_index': [], 'transportation_index': [], 'misc_index': []}
            state_data[state_code]['col_index'].append(row[1])
            state_data[state_code]['grocery_index'].append(row[2])
            state_data[state_code]['housing_index'].append(row[3])
            state_data[state_code]['utilities_index'].append(row[4])
            state_data[state_code]['transportation_index'].append(row[5])
            state_data[state_code]['misc_index'].append(row[6])

    values = []
    values.append((
        "0000000",
        "National Average",
        100.0, 100.0, 100.0, 100.0, 100.0, 100.0,
        2026, 1
    ))

    state_names = {
        '00': 'National Average', '01': 'Alabama', '02': 'Alaska', '04': 'Arizona', '05': 'Arkansas',
        '06': 'California', '08': 'Colorado', '09': 'Connecticut', '10': 'Delaware', '11': 'District of Columbia',
        '12': 'Florida', '13': 'Georgia', '15': 'Hawaii', '16': 'Idaho', '17': 'Illinois', '18': 'Indiana',
        '19': 'Iowa', '20': 'Kansas', '21': 'Kentucky', '22': 'Louisiana', '23': 'Maine', '24': 'Maryland',
        '25': 'Massachusetts', '26': 'Michigan', '27': 'Minnesota', '28': 'Mississippi', '29': 'Missouri',
        '30': 'Montana', '31': 'Nebraska', '32': 'Nevada', '33': 'New Hampshire', '34': 'New Jersey',
        '35': 'New Mexico', '36': 'New York', '37': 'North Carolina', '38': 'North Dakota', '39': 'Ohio',
        '40': 'Oklahoma', '41': 'Oregon', '42': 'Pennsylvania', '44': 'Rhode Island', '45': 'South Carolina',
        '46': 'South Dakota', '47': 'Tennessee', '48': 'Texas', '49': 'Utah', '50': 'Vermont',
        '51': 'Virginia', '53': 'Washington', '54': 'West Virginia', '55': 'Wisconsin', '56': 'Wyoming',
        '72': 'Puerto Rico'
    }

    for state_fips, data in state_data.items():
        if state_fips == '00':
            continue

        avg_col = sum(data['col_index']) / len(data['col_index']) if data['col_index'] else 100.0
        avg_grocery = sum(data['grocery_index']) / len(data['grocery_index']) if data['grocery_index'] else 100.0
        avg_housing = sum(data['housing_index']) / len(data['housing_index']) if data['housing_index'] else 100.0
        avg_utilities = sum(data['utilities_index']) / len(data['utilities_index']) if data['utilities_index'] else 100.0
        avg_transport = sum(data['transportation_index']) / len(data['transportation_index']) if data['transportation_index'] else 100.0
        avg_misc = sum(data['misc_index']) / len(data['misc_index']) if data['misc_index'] else 100.0

        values.append((
            state_fips,
            state_names.get(state_fips, f"State {state_fips}"),
            round(avg_col, 2),
            round(avg_grocery, 2),
            round(avg_housing, 2),
            round(avg_utilities, 2),
            round(avg_transport, 2),
            round(avg_misc, 2),
            2026, 1
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
    log(f"  Transformed {len(values)} cost of living records ({len(state_data)} states)")

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
            s.year,
            s.prim_state
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
        SELECT onet_soc_code, data_value
        FROM onet_education
        WHERE category = 1
    """)
    for row in cursor.fetchall():
        if row[0] and row[1]:
            education_cache[row[0]] = str(row[1])
    
    log("  Loading job zones from O*NET...")
    job_zone_cache = {}
    cursor.execute("""
        SELECT DISTINCT ON (data->>'O*NET-SOC Code')
            data->>'O*NET-SOC Code' as onet_code,
            data->>'Job Zone' as job_zone
        FROM onet_data
        WHERE data_type = 'job_zones'
          AND data->>'Job Zone' IS NOT NULL
        ORDER BY data->>'O*NET-SOC Code', (data->>'Job Zone')::NUMERIC ASC
    """)
    for row in cursor.fetchall():
        if row[0] and row[1]:
            job_zone_cache[row[0]] = int(row[1])
    
    log("  Loading skills from career_profiles...")
    skills_cache = {}
    cursor.execute("""
        SELECT occupation_code, skills FROM career_profiles WHERE skills != '[]'
    """)
    for row in cursor.fetchall():
        if row[0] and row[1]:
            raw_code = row[0]
            if '-' in raw_code:
                normalized = raw_code.replace('-', '')
            else:
                normalized = raw_code
            skills_cache[raw_code] = row[1]
            skills_cache[normalized] = row[1]
    
    log("  Loading cost of living data...")
    col_cache = {}
    state_to_fips = {
        'AL': '01', 'AK': '02', 'AZ': '04', 'AR': '05', 'CA': '06', 'CO': '08', 'CT': '09', 'DE': '10',
        'DC': '11', 'FL': '12', 'GA': '13', 'HI': '15', 'ID': '16', 'IL': '17', 'IN': '18', 'IA': '19',
        'KS': '20', 'KY': '21', 'LA': '22', 'ME': '23', 'MD': '24', 'MA': '25', 'MI': '26', 'MN': '27',
        'MS': '28', 'MO': '29', 'MT': '30', 'NE': '31', 'NV': '32', 'NH': '33', 'NJ': '34', 'NM': '35',
        'NY': '36', 'NC': '37', 'ND': '38', 'OH': '39', 'OK': '40', 'OR': '41', 'PA': '42', 'RI': '44',
        'SC': '45', 'SD': '46', 'TN': '47', 'TX': '48', 'UT': '49', 'VT': '50', 'VA': '51', 'WA': '53',
        'WV': '54', 'WI': '55', 'WY': '56', 'PR': '72'
    }
    cursor.execute("""
        SELECT area_code, col_index FROM career_cost_of_living
    """)
    for row in cursor.fetchall():
        if row[0] and row[1] is not None:
            fips_code = row[0]
            col_cache[fips_code] = float(row[1])
    state_col_cache = {}
    for state_abbr, fips_code in state_to_fips.items():
        if fips_code in col_cache:
            state_col_cache[state_abbr] = col_cache[fips_code]
    
    log("  Loading average tuition costs from IPEDS...")
    tuition_by_level = {}
    for cat in ['1', '2', '3', '4', '5', '6', '7', '8', '9']:
        tuition_by_level[cat] = get_tuition_by_education_level(cat)
    
    default_tuition = sum(tuition_by_level.values()) / len(tuition_by_level) if tuition_by_level else 30000

    values = []
    processed = 0
    for row in rows:
        occ_code, occ_title, area_code, area_title, industry_code, industry_name, annual_median, annual_mean, hourly_median, employment, year, prim_state = row

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
        
        job_zone = job_zone_cache.get(onet_code)
        if not job_zone:
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
        
        education_years_map = {
            1: 0,   # Less than high school
            2: 0,   # High school diploma
            3: 1,   # Postsecondary certificate
            4: 2,   # Some college
            5: 2,   # Associate's degree
            6: 4,   # Bachelor's degree
            7: 6,   # Master's degree
            8: 8,   # Doctoral degree
            9: 8,   # Professional degree
            10: 8,  # First professional degree
            11: 10, # Doctoral degree
            12: 12, # Post-doctoral training
        }
        school_years = education_years_map.get(cat_int, 4)
        
        inflation_rate = 0.03
        salary_growth_rate = 0.02
        career_years = 35
        
        total_earnings = 0
        total_cost = edu_cost
        for year in range(career_years):
            if year < school_years:
                total_cost += annual_median_float * 0.3
            else:
                salary = annual_median_float * ((1 + salary_growth_rate) ** (year - school_years))
                present_value = salary / ((1 + inflation_rate) ** year)
                total_earnings += present_value
        
        net_roi = total_earnings - total_cost
        annualized_roi = (((total_earnings / total_cost) ** (1.0 / career_years)) - 1) * 100 if total_cost > 0 else 0
        
        cumulative_earnings = 0
        cumulative_cost = edu_cost
        breakeven_year = 0
        for year in range(career_years):
            if year < school_years:
                cumulative_cost += annual_median_float * 0.3
            else:
                salary = annual_median_float * ((1 + salary_growth_rate) ** (year - school_years))
                cumulative_earnings += salary
                if cumulative_earnings >= cumulative_cost and breakeven_year == 0:
                    breakeven_year = year - school_years + 1
        
        years_to_breakeven = breakeven_year if breakeven_year > 0 else career_years
        if years_to_breakeven < 2:
            years_to_breakeven = 2
        
        roi_pct = annualized_roi

        col_index = state_col_cache.get(prim_state, 100.0)
        adjusted_salary = annual_median_float * (100.0 / col_index) if col_index > 0 else annual_median_float
        
        skills = skills_cache.get(occ_code)
        if not skills:
            if '-' in occ_code:
                alt_code = occ_code.replace('-', '')
                skills = skills_cache.get(alt_code)
        if not skills:
            if len(occ_code) == 6:
                alt_code = f"{occ_code[:2]}-{occ_code[2:]}"
                skills = skills_cache.get(alt_code)
        if not skills:
            base_code = occ_code.replace('-', '')[:4]
            for cached_code in skills_cache:
                if cached_code.startswith(base_code):
                    skills = skills_cache[cached_code]
                    break

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
            json.dumps(skills) if skills else None,
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

def clean_numeric(val):
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val)
    if isinstance(val, str):
        val = val.strip()
        if val in ('#', '-', '', '*', '**', 'N/A'):
            return None
        try:
            return float(val)
        except:
            return None
    return None


def transform_education_cost_by_state_occupation():
    log("Computing education cost per occupation per state...")
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("DELETE FROM education_cost_by_state_occupation")
    conn.commit()
    
    log("  Building CIP to O*NET crosswalk lookup...")
    cip_onet_map = {}
    try:
        cursor.execute("""
            SELECT onet_soc_code, cip_code
            FROM cip_onet_crosswalk
        """)
        for row in cursor.fetchall():
            onet_code, cip_code = row
            if onet_code and cip_code:
                if onet_code not in cip_onet_map:
                    cip_onet_map[onet_code] = []
                cip_onet_map[onet_code].append(cip_code)
    except Exception as e:
        log(f"    CIP-O*NET crosswalk table not available: {e}")
        conn.rollback()
    
    log("  Building CIP to institution lookup from completions...")
    cip_institution_map = {}
    try:
        cursor.execute("""
            SELECT ic.cipcode, i.unitid, i.state, i.iclevel, i.institution_name
            FROM ipeds_completions ic
            JOIN institutions i ON ic.unitid = i.unitid
            WHERE ic.ctotalt > 0
        """)
        for row in cursor.fetchall():
            cipcode, unitid, state, iclevel, inst_name = row
            if cipcode and unitid:
                cip_prefix = cipcode[:2]
                if cip_prefix not in cip_institution_map:
                    cip_institution_map[cip_prefix] = {}
                if state not in cip_institution_map[cip_prefix]:
                    cip_institution_map[cip_prefix][state] = {}
                if iclevel not in cip_institution_map[cip_prefix][state]:
                    cip_institution_map[cip_prefix][state][iclevel] = []
                cip_institution_map[cip_prefix][state][iclevel].append(unitid)
    except Exception as e:
        log(f"    Could not build CIP-institution map: {e}")
        conn.rollback()
    
    log("  Building tuition lookup by CIP prefix, state, and institution level...")
    tuition_by_cip_state_ilevel = {}
    try:
        cursor.execute("""
            SELECT 
                i.unitid,
                i.state,
                i.iclevel,
                c.data->>'TUITION2' as tuition_in_state,
                c.data->>'FEE2' as fees_in_state
            FROM institutions i
            LEFT JOIN ipeds_cost c ON i.unitid = c.unitid
            WHERE i.state IS NOT NULL
        """)
        
        for row in cursor.fetchall():
            unitid, state, iclevel, tuition_in, fees_in = row
            if not state:
                continue
                
            tuition = clean_numeric(tuition_in) or 0
            fees = clean_numeric(fees_in) or 0
            total = tuition + fees
            
            if total > 0:
                if state not in tuition_by_cip_state_ilevel:
                    tuition_by_cip_state_ilevel[state] = {}
                if iclevel not in tuition_by_cip_state_ilevel[state]:
                    tuition_by_cip_state_ilevel[state][iclevel] = []
                tuition_by_cip_state_ilevel[state][iclevel].append((unitid, total))
    except Exception as e:
        log(f"    Could not build tuition lookup: {e}")
        conn.rollback()
    
    log("  Building institution tuition lookup by state...")
    cursor.execute("""
        SELECT 
            i.unitid,
            i.state,
            i.iclevel,
            c.data->>'TUITION2' as tuition_in_state,
            c.data->>'FEE2' as fees_in_state
        FROM institutions i
        LEFT JOIN ipeds_cost c ON i.unitid = c.unitid
        WHERE i.state IS NOT NULL
    """)
    
    tuition_by_state_ilevel = {}
    for row in cursor.fetchall():
        unitid, state, iclevel, tuition_in, fees_in = row
        if state not in tuition_by_state_ilevel:
            tuition_by_state_ilevel[state] = {}
        
        tuition = clean_numeric(tuition_in) or 0
        fees = clean_numeric(fees_in) or 0
        total = tuition + fees
        
        if total > 0:
            if iclevel not in tuition_by_state_ilevel[state]:
                tuition_by_state_ilevel[state][iclevel] = []
            tuition_by_state_ilevel[state][iclevel].append(total)
    
    log("  Computing average tuition by state and institution level...")
    avg_tuition_by_state_ilevel = {}
    for state, ilevels in tuition_by_state_ilevel.items():
        for ilevel, tuition_list in ilevels.items():
            if tuition_list:
                avg_tuition_by_state_ilevel[(state, ilevel)] = sum(tuition_list) / len(tuition_list)
    
    log("  Building O*NET education lookup...")
    cursor.execute("""
        SELECT onet_soc_code, category, data_value, data_value_label
        FROM onet_education
        WHERE category = 1
    """)
    
    onet_education = {}
    for row in cursor.fetchall():
        onet_code, category, data_value, data_value_label = row
        if onet_code:
            normalized_code = onet_code.replace('.00', '')
            onet_education[normalized_code] = {
                'data_value': data_value,
                'data_value_label': data_value_label
            }
            onet_education[onet_code] = {
                'data_value': data_value,
                'data_value_label': data_value_label
            }
    
    log("  Building O*NET-SOC to SOC 2018 crosswalk lookup...")
    onet_to_soc = {}
    try:
        cursor.execute("""
            SELECT onet_soc_code, soc_2018_code
            FROM onet_soc_crosswalk
        """)
        for row in cursor.fetchall():
            onet_code, soc_code = row
            if onet_code and soc_code:
                onet_to_soc[onet_code] = soc_code
    except:
        log("    Crosswalk table not available, using direct occupation codes")
    
    log("  Processing BLS state wages (detailed occupations only)...")
    cursor.execute("""
        SELECT DISTINCT ON (s.occ_code, s.prim_state)
            s.occ_code,
            s.occ_title,
            s.prim_state as state,
            s.a_median as median_wage
        FROM salaries s
        WHERE s.o_group = 'detailed'
          AND s.occ_code IS NOT NULL
          AND s.prim_state IS NOT NULL
          AND s.a_median IS NOT NULL
          AND s.area_type = 2
        ORDER BY s.occ_code, s.prim_state, s.tot_emp DESC
    """)
    
    wage_records = cursor.fetchall()
    log(f"  Found {len(wage_records)} state-occupation combinations with wages")
    
    education_level_map = {
        1: 'Less than high school',
        2: 'High school diploma',
        3: 'Postsecondary certificate',
        4: 'Some college, no degree',
        5: "Associate's degree",
        6: "Bachelor's degree",
        7: "Master's degree",
        8: 'Doctoral degree',
        9: 'Professional degree',
        10: 'First professional degree',
        11: 'Doctoral degree',
        12: 'Post-doctoral training',
    }
    
    values = []
    for occ_code, occ_title, state, median_wage in wage_records:
        if not occ_code or not state:
            continue
        
        edu_info = onet_education.get(occ_code)
        
        if not edu_info:
            continue
        
        edu_data_value = edu_info.get('data_value', 4)
        edu_label = edu_info.get('data_value_label', education_level_map.get(edu_data_value, 'varies'))
        
        if edu_data_value >= 8:
            target_ilevel = 3
        elif edu_data_value >= 6:
            target_ilevel = 2
        elif edu_data_value >= 5:
            target_ilevel = 2
        else:
            target_ilevel = 1
        
        cip_code = cip_onet_map.get(occ_code, [None])[0] if cip_onet_map.get(occ_code) else None
        cip_prefix = cip_code[:2] if cip_code else None
        
        avg_tuition = None
        
        if cip_prefix and cip_prefix in cip_institution_map and state in cip_institution_map[cip_prefix]:
            cip_units = cip_institution_map[cip_prefix][state].get(target_ilevel, [])
            if not cip_units and target_ilevel in cip_institution_map[cip_prefix][state]:
                cip_units = cip_institution_map[cip_prefix][state][target_ilevel]
            
            if cip_units and state in tuition_by_cip_state_ilevel:
                cip_tuitions = []
                for unitid, tuition in tuition_by_cip_state_ilevel[state].get(target_ilevel, []):
                    if unitid in cip_units:
                        cip_tuitions.append(tuition)
                if cip_tuitions:
                    avg_tuition = sum(cip_tuitions) / len(cip_tuitions)
        
        if avg_tuition is None:
            avg_tuition = avg_tuition_by_state_ilevel.get((state, target_ilevel))
        
        if avg_tuition is None:
            if target_ilevel == 2:
                avg_tuition = avg_tuition_by_state_ilevel.get((state, 1))
            elif target_ilevel == 1:
                avg_tuition = avg_tuition_by_state_ilevel.get((state, 2))
        
        if avg_tuition is None:
            all_tuitions = []
            for ilevel, t in tuition_by_state_ilevel.get(state, {}).items():
                all_tuitions.extend(t)
            if all_tuitions:
                avg_tuition = sum(all_tuitions) / len(all_tuitions)
        
        if avg_tuition is not None:
            cip_title = None
            if cip_code:
                try:
                    cursor.execute("""
                        SELECT cip_title FROM cip_soc_crosswalk 
                        WHERE cip_code = %s LIMIT 1
                    """, (cip_code,))
                    result = cursor.fetchone()
                    if result:
                        cip_title = result[0]
                except:
                    pass
            
            values.append((
                state,
                occ_code,
                occ_title,
                median_wage,
                edu_label,
                edu_data_value,
                cip_code,
                cip_title,
                avg_tuition,
                None,
                2024
            ))
    
    log(f"  Inserting {len(values)} education cost records...")
    
    query = """
        INSERT INTO education_cost_by_state_occupation 
        (state, occ_code, occ_title, median_annual_wage, education_level, education_data_value,
         cip_code, cip_title, avg_tuition, total_completions, year)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (state, occ_code) DO NOTHING
    """
    
    if values:
        execute_batch(cursor, query, values)
        conn.commit()
    
    cursor.close()
    conn.close()
    log(f"  Computed education cost for {len(values)} state-occupation pairs")


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

    transform_education_cost_by_state_occupation()
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
        UNION ALL SELECT 'education_cost_by_state_occupation', COUNT(*) FROM education_cost_by_state_occupation
    """)
    log("\nTable summary:")
    for row in cursor.fetchall():
        log(f"  {row[0]}: {row[1]} rows")
    cursor.close()
    conn.close()

if __name__ == '__main__':
    main()
