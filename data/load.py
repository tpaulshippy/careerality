#!/usr/bin/env python3

import os
import json
import sys
import numpy as np
import pandas as pd
import psycopg2
import warnings

from soc_utils import normalize_soc_code

warnings.filterwarnings('ignore')

def log(msg):
    print(msg)
    sys.stdout.flush()

DATA_DIR = os.path.dirname(__file__)

DB_CONFIG = {
    'dbname': 'careerality',
    'user': 'postgres',
    'password': 'postgres',
    'host': 'localhost'
}

def get_connection():
    return psycopg2.connect(**DB_CONFIG)

def clean_numeric(val):
    if pd.isna(val):
        return None
    if isinstance(val, (int, float, np.integer, np.floating)):
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

def clean_int(val):
    if pd.isna(val):
        return None
    if isinstance(val, (int, np.integer)):
        return int(val)
    if isinstance(val, (float, np.floating)):
        if pd.isna(val):
            return None
        return int(val)
    if isinstance(val, str):
        val = val.strip()
        if val in ('#', '-', '', '*', '**', 'N/A'):
            return None
        try:
            return int(val)
        except:
            return None
    return None

def load_csv_to_table(filepath, table_name):
    if not os.path.exists(filepath):
        log(f"    File not found: {filepath}")
        return 0
    
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        df = pd.read_csv(filepath, sep=',', low_memory=False)
        
        if df.empty:
            return 0
            
        df.columns = df.columns.str.strip()
        
        if table_name == 'student_financial_aid':
            data_dict = df.to_dict(orient='records')
            clean_data = []
            for row in data_dict:
                clean_row = {}
                for k, v in row.items():
                    if pd.isna(v):
                        clean_row[k] = None
                    else:
                        clean_row[k] = v
                clean_data.append(clean_row)
            
            query = 'INSERT INTO student_financial_aid (unitid, data) VALUES (%s, %s)'
            for row in clean_data:
                try:
                    unitid = row.get('UNITID')
                    cursor.execute(query, (unitid, json.dumps(row)))
                except:
                    pass
            conn.commit()
            cursor.close()
            conn.close()
            return len(df)
        
        columns = df.columns.tolist()
        col_str = ', '.join([f'"{c}"' for c in columns])
        placeholders = ', '.join(['%s'] * len(columns))
        
        values = []
        for _, row in df.iterrows():
            row_values = []
            for v in row.values:
                if pd.isna(v):
                    row_values.append(None)
                else:
                    row_values.append(v)
            values.append(tuple(row_values))
        
        query = f'INSERT INTO {table_name} ({col_str}) VALUES ({placeholders}) ON CONFLICT DO NOTHING'
        
        from psycopg2.extras import execute_batch
        execute_batch(cursor, query, values)
        conn.commit()
        
        count = len(df)
        cursor.close()
        conn.close()
        return count
        
    except Exception as e:
        print(f"    Error: {e}")
        cursor.close()
        conn.close()
        return 0

def load_tsv_to_table(filepath, table_name):
    if not os.path.exists(filepath):
        print(f"    File not found: {filepath}")
        return 0
    
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        df = pd.read_csv(filepath, sep='\t', low_memory=False)
        
        if df.empty:
            return 0
        
        df.columns = df.columns.str.strip()
        
        columns = df.columns.tolist()
        col_str = ', '.join([f'"{c}"' for c in columns])
        placeholders = ', '.join(['%s'] * len(columns))
        
        values = []
        for _, row in df.iterrows():
            row_values = []
            for v in row.values:
                if pd.isna(v):
                    row_values.append(None)
                else:
                    row_values.append(v)
            values.append(tuple(row_values))
        
        query = f'INSERT INTO {table_name} ({col_str}) VALUES ({placeholders}) ON CONFLICT DO NOTHING'
        
        from psycopg2.extras import execute_batch
        execute_batch(cursor, query, values)
        conn.commit()
        
        count = len(df)
        cursor.close()
        conn.close()
        return count
        
    except Exception as e:
        print(f"    Error: {e}")
        cursor.close()
        conn.close()
        return 0

def load_onet_data():
    print("Loading O*NET data...")
    
    conn = get_connection()
    cursor = conn.cursor()
    
    onet_dir = os.path.join(DATA_DIR, 'careers', 'onetsql', 'db_30_2_text')
    
    files = [
        ('occupations', 'Occupation Data.txt'),
        ('abilities', 'Abilities.txt'),
        ('skills', 'Skills.txt'),
        ('knowledge', 'Knowledge.txt'),
        ('tasks', 'Task Statements.txt'),
        ('work_activities', 'Work Activities.txt'),
        ('work_context', 'Work Context.txt'),
        ('work_styles', 'Work Styles.txt'),
        ('interests', 'Interests.txt'),
        ('work_values', 'Work Values.txt'),
        ('job_zones', 'Job Zones.txt'),
        ('technology_skills', 'Technology Skills.txt'),
        ('tools_used', 'Tools Used.txt'),
        ('education_experience', 'Education, Training, and Experience.txt'),
    ]
    
    for data_type, filename in files:
        filepath = os.path.join(onet_dir, filename)
        if os.path.exists(filepath):
            print(f"  Loading {filename}...")
            try:
                df = pd.read_csv(filepath, sep='\t', low_memory=False)
                df.columns = df.columns.str.strip()
                
                data_dict = df.to_dict(orient='records')
                clean_data = []
                for row in data_dict:
                    clean_row = {}
                    for k, v in row.items():
                        if pd.isna(v):
                            clean_row[k] = None
                        else:
                            clean_row[k] = v
                    clean_data.append(clean_row)
                
                query = 'INSERT INTO onet_data (data_type, data) VALUES (%s, %s)'
                for row in clean_data:
                    try:
                        cursor.execute(query, (data_type, json.dumps(row)))
                    except:
                        pass
                
                conn.commit()
                print(f"    Loaded {len(df)} rows")
            except Exception as e:
                print(f"    Error: {e}")
        else:
            print(f"  {filename} not found")
    
    cursor.close()
    conn.close()

def load_education_data():
    print("Loading education data...")
    
    filepath = os.path.join(DATA_DIR, 'education', 'sfa2223.csv')
    print(f"  Loading student_financial_aid...")
    count = load_csv_to_table(filepath, 'student_financial_aid')
    print(f"    Loaded {count} rows")
    
    load_ipeds_institutions()
    load_ipeds_institutional_characteristics()
    load_ipeds_cost_data()


def load_ipeds_cost_data():
    print("Loading IPEDS Cost data (tuition)...")
    
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        cost_files = ['COST1_2024.csv', 'COST2_2024.csv']
        
        for filename in cost_files:
            filepath = os.path.join(DATA_DIR, 'education', filename)
            if not os.path.exists(filepath):
                print(f"    File not found: {filename}, skipping")
                continue
            
            print(f"  Loading {filename}...")
            df = pd.read_csv(filepath, low_memory=False)
            
            values = []
            for _, row in df.iterrows():
                unitid = clean_int(row.get('UNITID'))
                if not unitid:
                    continue
                row_data = row.to_dict()
                for key, value in row_data.items():
                    if pd.isna(value):
                        row_data[key] = None
                values.append((unitid, json.dumps(row_data)))
            
            if values:
                query = '''
                    INSERT INTO ipeds_cost (unitid, data)
                    VALUES (%s, %s::jsonb)
                '''
                from psycopg2.extras import execute_batch
                execute_batch(cursor, query, values)
                conn.commit()
                print(f"    Loaded {len(values)} rows from {filename}")
            else:
                print(f"    No data to load from {filename}")
    
    except Exception as e:
        print(f"  Error loading IPEDS cost data: {e}")
    finally:
        cursor.close()
        conn.close()


def load_ipeds_institutions():
    print("Loading IPEDS institutions (HD2023)...")
    
    filepath = os.path.join(DATA_DIR, 'education', 'HD2023.csv')
    if not os.path.exists(filepath):
        print(f"    File not found: {filepath}")
        return
    
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        df = pd.read_csv(filepath, sep=',', low_memory=False)
        df.columns = df.columns.str.strip()
        
        values = []
        for _, row in df.iterrows():
            unitid = clean_int(row.get('UNITID'))
            if not unitid:
                continue
            values.append((
                unitid,
                row.get('INSTNM'),
                row.get('ADDR'),
                row.get('CITY'),
                row.get('STABBR'),
                row.get('ZIP'),
                clean_int(row.get('SECTOR')),
                clean_int(row.get('CONTROL')),
                clean_int(row.get('ICLEVEL')),
                clean_int(row.get('HLOFFER')),
                clean_int(row.get('CBSA')),
                clean_int(row.get('LOCALE'))
            ))
        
        query = '''
            INSERT INTO institutions 
            (unitid, institution_name, address, city, state, zip, sector, control, iclevel, hloffer, cbsa, locele)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (unitid) DO NOTHING
        '''
        
        from psycopg2.extras import execute_batch
        execute_batch(cursor, query, values)
        conn.commit()
        
        print(f"    Loaded {len(values)} institutions")
        
    except Exception as e:
        print(f"    Error: {e}")
    finally:
        cursor.close()
        conn.close()


def load_ipeds_institutional_characteristics():
    print("Loading IPEDS institutional characteristics (IC2023)...")
    
    filepath = os.path.join(DATA_DIR, 'education', 'IC2023.csv')
    if not os.path.exists(filepath):
        print(f"    File not found: {filepath}")
        return
    
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        df = pd.read_csv(filepath, sep=',', low_memory=False)
        df.columns = df.columns.str.strip()
        
        values = []
        for _, row in df.iterrows():
            unitid = clean_int(row.get('UNITID'))
            if not unitid:
                continue
            
            room_amt = clean_numeric(row.get('ROOMAMT'))
            if room_amt and str(row.get('XROOMAMT')) == 'R':
                room_amt = room_amt
            else:
                room_amt = None
            
            board_amt = clean_numeric(row.get('BOARDAMT'))
            if board_amt and str(row.get('XBORDAMT')) == 'R':
                board_amt = board_amt
            else:
                board_amt = None
            
            applfee = clean_numeric(row.get('APPLFEEU'))
            if applfee and str(row.get('XAPPFEEU')) == 'R':
                applfee = applfee
            else:
                applfee = None
            
            values.append((
                unitid,
                row.get('TUITPL'),
                row.get('ROOM'),
                room_amt,
                row.get('BOARD'),
                board_amt,
                applfee,
                clean_int(row.get('YRSCOLL'))
            ))
        
        query = '''
            INSERT INTO institutional_characteristics 
            (unitid, tuition_pl, room, room_amt, board, board_amt, applfee_u, year_school)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (unitid) DO NOTHING
        '''
        
        from psycopg2.extras import execute_batch
        execute_batch(cursor, query, values)
        conn.commit()
        
        print(f"    Loaded {len(values)} institutional characteristics records")
        
    except Exception as e:
        print(f"    Error: {e}")
    finally:
        cursor.close()
        conn.close()

def load_salary_reference_data():
    print("Loading salary reference data...")
    
    files = {
        'salary_occupations': os.path.join(DATA_DIR, 'salary', 'oe.occupation'),
        'salary_areas': os.path.join(DATA_DIR, 'salary', 'oe.area'),
        'salary_industries': os.path.join(DATA_DIR, 'salary', 'oe.industry'),
        'salary_datatypes': os.path.join(DATA_DIR, 'salary', 'oe.datatype'),
        'salary_sector': os.path.join(DATA_DIR, 'salary', 'oe.sector'),
    }
    
    for table_name, filepath in files.items():
        print(f"  Loading {table_name}...")
        count = load_tsv_to_table(filepath, table_name)
        print(f"    Loaded {count} rows")

def load_cost_of_living():
    print("Loading cost of living data...")
    
    col_file = os.path.join(DATA_DIR, 'cost-of-living', 'fbc_data_2026.xlsx')
    if not os.path.exists(col_file):
        print("  Cost of living file not found")
        return
    
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        df = pd.read_excel(col_file)
        
        df.columns = [c.strip() for c in df.columns]
        
        values = []
        for _, row in df.iterrows():
            values.append((
                row.get('Area'),
                row.get('COL Index') if pd.notna(row.get('COL Index')) else None,
                row.get('Grocery Index') if pd.notna(row.get('Grocery Index')) else None,
                row.get('Housing Index') if pd.notna(row.get('Housing Index')) else None,
                row.get('Utilities Index') if pd.notna(row.get('Utilities Index')) else None,
                row.get('Transportation Index') if pd.notna(row.get('Transportation Index')) else None,
                row.get('Misc Index') if pd.notna(row.get('Misc Index')) else None,
                2026,
                1
            ))
        
        query = '''
            INSERT INTO cost_of_living 
            (area, col_index, grocery_index, housing_index, utilities_index, transportation_index, misc_index, year, quarter)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        '''
        
        from psycopg2.extras import execute_batch
        execute_batch(cursor, query, values)
        conn.commit()
        
        print(f"  Loaded {len(df)} rows")
        
    except Exception as e:
        print(f"  Error: {e}")
    finally:
        cursor.close()
        conn.close()


def load_state_employment_projections():
    import json
    
    print("Loading state employment projections data...")
    
    long_term_file = os.path.join(DATA_DIR, 'projections', 'state_employment_projections_long_term.json')
    short_term_file = os.path.join(DATA_DIR, 'projections', 'state_employment_projections_short_term.json')
    
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        if os.path.exists(long_term_file):
            print(f"  Loading Long-Term projections from {long_term_file}...")
            with open(long_term_file, 'r') as f:
                projections = json.load(f)
            
            values = []
            for row in projections:
                base_emp = clean_int(row.get('base_employment'))
                projected_emp = clean_int(row.get('projected_employment'))
                change = clean_int(row.get('change'))
                pct_change = clean_numeric(row.get('percent_change'))
                openings = clean_int(row.get('avg_annual_openings'))
                base_year = clean_int(row.get('base_year'))
                proj_year = clean_int(row.get('proj_year'))
                
                values.append((
                    row.get('state_fips'),
                    row.get('state_abbr'),
                    row.get('occ_code'),
                    row.get('title'),
                    base_emp,
                    projected_emp,
                    change,
                    pct_change,
                    openings,
                    base_year,
                    proj_year,
                    'long_term'
                ))
            
            query = '''
                INSERT INTO state_employment_projections 
                (state_fips, state_abbr, occ_code, occupation_title, base_employment, 
                 projected_employment, employment_change, percent_change, avg_annual_openings,
                 base_year, proj_year, projection_type)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT DO NOTHING
            '''
            
            from psycopg2.extras import execute_batch
            execute_batch(cursor, query, values)
            conn.commit()
            print(f"    Loaded {len(values)} long-term projection records")
        else:
            print(f"  Long-term projections file not found")
        
        if os.path.exists(short_term_file):
            print(f"  Loading Short-Term projections from {short_term_file}...")
            with open(short_term_file, 'r') as f:
                projections = json.load(f)
            
            values = []
            for row in projections:
                base_emp = clean_int(row.get('base_employment'))
                projected_emp = clean_int(row.get('projected_employment'))
                change = clean_int(row.get('change'))
                pct_change = clean_numeric(row.get('percent_change'))
                openings = clean_int(row.get('avg_annual_openings'))
                base_year = clean_int(row.get('base_year'))
                proj_year = clean_int(row.get('proj_year'))
                
                values.append((
                    row.get('state_fips'),
                    row.get('state_abbr'),
                    row.get('occ_code'),
                    row.get('title'),
                    base_emp,
                    projected_emp,
                    change,
                    pct_change,
                    openings,
                    base_year,
                    proj_year,
                    'short_term'
                ))
            
            query = '''
                INSERT INTO state_employment_projections 
                (state_fips, state_abbr, occ_code, occupation_title, base_employment, 
                 projected_employment, employment_change, percent_change, avg_annual_openings,
                 base_year, proj_year, projection_type)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT DO NOTHING
            '''
            
            from psycopg2.extras import execute_batch
            execute_batch(cursor, query, values)
            conn.commit()
            print(f"    Loaded {len(values)} short-term projection records")
        else:
            print(f"  Short-term projections file not found")
    
    except Exception as e:
        print(f"  Error: {e}")
    finally:
        cursor.close()
        conn.close()

def load_bls_state_wages():
    log("Loading BLS state wages data...")
    
    state_excel = os.path.join(DATA_DIR, 'salary', 'oesm24st')
    if not os.path.exists(state_excel):
        log("  State wages directory not found")
        return
    
    xlsx_files = [f for f in os.listdir(state_excel) if f.endswith('.xlsx') or f.endswith('.xls')]
    if not xlsx_files:
        log("  No Excel files found in oesm24st directory")
        return
    
    excel_file = os.path.join(state_excel, xlsx_files[0])
    log(f"  Loading {xlsx_files[0]}...")
    
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        df = pd.read_excel(excel_file)
        df.columns = df.columns.str.strip().str.lower()
        log(f"  Loaded {len(df)} rows from Excel, processing...")
        
        values = []
        for idx, row in df.iterrows():
            values.append((
                str(row.get('area', '')),
                str(row.get('area_title')) if pd.notna(row.get('area_title')) else None,
                clean_int(row.get('area_type')),
                str(row.get('prim_state')) if pd.notna(row.get('prim_state')) else None,
                str(row.get('naics')) if pd.notna(row.get('naics')) else None,
                str(row.get('naics_title')) if pd.notna(row.get('naics_title')) else None,
                str(row.get('i_group')) if pd.notna(row.get('i_group')) else None,
                clean_int(row.get('own_code')),
                str(row.get('occ_code')) if pd.notna(row.get('occ_code')) else None,
                str(row.get('occ_title')) if pd.notna(row.get('occ_title')) else None,
                str(row.get('o_group')) if pd.notna(row.get('o_group')) else None,
                clean_int(row.get('tot_emp')),
                clean_numeric(row.get('emp_prse')),
                clean_numeric(row.get('h_mean')),
                clean_numeric(row.get('a_mean')),
                clean_numeric(row.get('h_median')),
                clean_numeric(row.get('a_median')),
                2024
            ))
        
        query = '''
            INSERT INTO bls_state_wages 
            (area, area_title, area_type, prim_state, naics, naics_title, i_group, own_code, 
             occ_code, occ_title, o_group, tot_emp, emp_prse, h_mean, a_mean, h_median, a_median, year)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (occ_code, area, naics, own_code) DO NOTHING
        '''
        
        from psycopg2.extras import execute_batch
        
        batch_size = 5000
        for start in range(0, len(values), batch_size):
            end = min(start + batch_size, len(values))
            batch = values[start:end]
            execute_batch(cursor, query, batch)
            conn.commit()
            log(f"    Loaded {end} rows...")
            
        log(f"  Loaded {len(values)} state wage records")
        
    except Exception as e:
        log(f"  Error: {e}")
    finally:
        cursor.close()
        conn.close()


def load_onet_education():
    log("Loading O*NET Education, Training & Experience data...")
    
    onet_dir = os.path.join(DATA_DIR, 'careers', 'onetsql', 'db_30_2_text')
    txt_file = os.path.join(onet_dir, 'Education, Training, and Experience.txt')
    
    if not os.path.exists(txt_file):
        log("  O*NET Education file not found, skipping")
        return
    
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        df = pd.read_csv(txt_file, sep='\t', low_memory=False)
        df.columns = df.columns.str.strip()
        log(f"  Loaded {len(df)} rows from file, processing...")
        
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
        
        edu_data = {}
        for idx, row in df.iterrows():
            onet_code = str(row.get('O*NET-SOC Code', '')).strip() if pd.notna(row.get('O*NET-SOC Code')) else None
            if not onet_code:
                continue
            
            element_id = str(row.get('Element ID', '')).strip() if pd.notna(row.get('Element ID')) else None
            scale_id = str(row.get('Scale ID', '')).strip() if pd.notna(row.get('Scale ID')) else None
            
            if element_id != '2.D.1' or scale_id != 'RL':
                continue
            
            category = clean_int(row.get('Category'))
            data_value = clean_numeric(row.get('Data Value'))
            
            if onet_code not in edu_data:
                edu_data[onet_code] = {'category': category, 'data_value': data_value}
            elif data_value and data_value > edu_data[onet_code].get('data_value', 0):
                edu_data[onet_code] = {'category': category, 'data_value': data_value}
        
        values = []
        for onet_code, data in edu_data.items():
            category = data.get('category')
            data_value = data.get('data_value')
            data_value_label = education_level_map.get(category, f'Category {category}')
            
            values.append((
                onet_code,
                1,
                'Required Level of Education',
                category,
                data_value_label
            ))
        
        query = '''
            INSERT INTO onet_education 
            (onet_soc_code, category, category_label, data_value, data_value_label)
            VALUES (%s, %s, %s, %s, %s)
        '''
        
        from psycopg2.extras import execute_batch
        
        if values:
            execute_batch(cursor, query, values)
            conn.commit()
            log(f"  Loaded {len(values)} education records")
        
    except Exception as e:
        log(f"  Error: {e}")
    finally:
        cursor.close()
        conn.close()


def load_onet_soc_crosswalk():
    log("Loading O*NET-SOC to SOC 2018 crosswalk...")
    
    onet_dir = os.path.join(DATA_DIR, 'careers', 'onetsql')
    excel_file = os.path.join(onet_dir, 'onet_soc_2019_to_soc_2018_crosswalk.xlsx')
    
    if not os.path.exists(excel_file):
        log("  O*NET SOC crosswalk file not found, skipping")
        return
    
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        df = pd.read_excel(excel_file)
        df.columns = df.columns.str.strip()
        log(f"  Loaded {len(df)} rows from Excel, processing...")
        
        values = []
        for idx, row in df.iterrows():
            onet_code = str(row.get(0, '')).strip() if pd.notna(row.get(0)) else None
            soc_code = str(row.get(1, '')).strip() if pd.notna(row.get(1)) else None
            soc_title = str(row.get(2, '')).strip() if pd.notna(row.get(2)) else None
            
            if onet_code and soc_code:
                values.append((
                    onet_code,
                    soc_code,
                    soc_title,
                    True
                ))
        
        query = '''
            INSERT INTO onet_soc_crosswalk 
            (onet_soc_code, soc_2018_code, soc_2018_title, is_primary)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT DO NOTHING
        '''
        
        from psycopg2.extras import execute_batch
        
        if values:
            execute_batch(cursor, query, values)
            conn.commit()
            log(f"  Loaded {len(values)} crosswalk records")
        
    except Exception as e:
        log(f"  Error: {e}")
    finally:
        cursor.close()
        conn.close()


def load_cip_soc_crosswalk():
    log("Loading CIP to SOC crosswalk...")
    
    cip_file = os.path.join(DATA_DIR, 'education', 'soc_2018_to_cip2020_crosswalk.xlsx')
    
    if not os.path.exists(cip_file):
        log("  CIP-SOC crosswalk file not found, skipping")
        return
    
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        df = pd.read_excel(cip_file, sheet_name=None)
        log(f"  Found {len(df)} sheets in workbook")
        
        values = []
        for sheet_name, sheet_df in df.items():
            sheet_df.columns = sheet_df.columns.str.strip()
            
            for idx, row in sheet_df.iterrows():
                soc_code = None
                cip_code = None
                cip_title = None
                
                for col in row.index:
                    col_lower = str(col).lower()
                    if 'soc' in col_lower and 'code' in col_lower:
                        soc_code = str(row[col]).strip() if pd.notna(row[col]) else None
                    elif 'cip' in col_lower and 'code' in col_lower:
                        cip_code = str(row[col]).strip() if pd.notna(row[col]) else None
                    elif 'cip' in col_lower and 'title' in col_lower:
                        cip_title = str(row[col]).strip() if pd.notna(row[col]) else None
                
                if soc_code and cip_code:
                    values.append((
                        soc_code,
                        cip_code,
                        cip_title,
                        False
                    ))
        
        if not values:
            for sheet_name, sheet_df in df.items():
                for idx, row in sheet_df.iterrows():
                    try:
                        soc_code = str(row.iloc[0]).strip() if pd.notna(row.iloc[0]) else None
                        cip_code = str(row.iloc[1]).strip() if pd.notna(row.iloc[1]) else None
                        cip_title = str(row.iloc[2]).strip() if len(row) > 2 and pd.notna(row.iloc[2]) else None
                        
                        if soc_code and cip_code:
                            values.append((
                                soc_code,
                                cip_code,
                                cip_title,
                                False
                            ))
                    except:
                        pass
        
        query = '''
            INSERT INTO cip_soc_crosswalk 
            (soc_code, cip_code, cip_title, is_primary)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT DO NOTHING
        '''
        
        from psycopg2.extras import execute_batch
        
        if values:
            execute_batch(cursor, query, values)
            conn.commit()
            log(f"  Loaded {len(values)} CIP-SOC crosswalk records")
        
    except Exception as e:
        log(f"  Error: {e}")
    finally:
        cursor.close()
        conn.close()


def load_onet_cip_crosswalk():
    log("Loading O*NET CIP to O*NET-SOC crosswalk...")
    
    cip_file = os.path.join(DATA_DIR, 'education', 'Education_CIP_to_ONET_SOC.xlsx')
    
    if not os.path.exists(cip_file):
        log("  O*NET CIP crosswalk file not found, skipping")
        return
    
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        df = pd.read_excel(cip_file)
        log(f"  Loaded {len(df)} rows from Excel, processing...")
        
        values = []
        for idx, row in df.iterrows():
            cip_code = str(row.iloc[0]).strip() if pd.notna(row.iloc[0]) else None
            onet_code = str(row.iloc[1]).strip() if pd.notna(row.iloc[1]) else None
            
            if cip_code and onet_code:
                values.append((
                    onet_code,
                    cip_code
                ))
        
        query = '''
            INSERT INTO cip_onet_crosswalk 
            (onet_soc_code, cip_code)
            VALUES (%s, %s)
            ON CONFLICT DO NOTHING
        '''
        
        from psycopg2.extras import execute_batch
        
        if values:
            execute_batch(cursor, query, values)
            conn.commit()
            log(f"  Loaded {len(values)} CIP-O*NET crosswalk records")
        
    except Exception as e:
        log(f"  Error: {e}")
    finally:
        cursor.close()
        conn.close()


def load_ipeds_completions():
    log("Loading IPEDS completions data...")
    
    comp_file = os.path.join(DATA_DIR, 'education', 'C2023_a.csv')
    
    if not os.path.exists(comp_file):
        log("  IPEDS completions file not found, skipping")
        return
    
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        df = pd.read_csv(comp_file, low_memory=False)
        df.columns = df.columns.str.strip()
        log(f"  Loaded {len(df)} rows from CSV, processing...")
        
        values = []
        for idx, row in df.iterrows():
            unitid = clean_int(row.get('UNITID'))
            if not unitid:
                continue
            
            cipcode = str(row.get('CIPCODE', '')).strip() if pd.notna(row.get('CIPCODE')) else None
            ctotalt = clean_int(row.get('CTOTALT'))
            
            if cipcode and ctotalt is not None:
                values.append((
                    unitid,
                    cipcode,
                    ctotalt,
                    2023
                ))
        
        query = '''
            INSERT INTO ipeds_completions 
            (unitid, cipcode, ctotalt, year)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (unitid, cipcode, year) DO NOTHING
        '''
        
        from psycopg2.extras import execute_batch
        
        batch_size = 10000
        for start in range(0, len(values), batch_size):
            end = min(start + batch_size, len(values))
            batch = values[start:end]
            execute_batch(cursor, query, batch)
            conn.commit()
            log(f"    Loaded {end} rows...")
        
        log(f"  Loaded {len(values)} completions records")
        
    except Exception as e:
        log(f"  Error: {e}")
    finally:
        cursor.close()
        conn.close()


def load_salaries():
    log("Loading salaries data from Excel (414K+ rows - this takes a while)...")
    
    excel_file = os.path.join(DATA_DIR, 'salary', 'oesm24all', 'all_data_M_2024.xlsx')
    if not os.path.exists(excel_file):
        log("  Salaries Excel file not found")
        return
    
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        df = pd.read_excel(excel_file)
        df.columns = df.columns.str.strip().str.lower()
        log(f"  Loaded {len(df)} rows from Excel, processing...")
        
        values = []
        for idx, row in df.iterrows():
            values.append((
                str(row.get('area', '')),
                str(row.get('area_title')) if pd.notna(row.get('area_title')) else None,
                clean_int(row.get('area_type')),
                str(row.get('prim_state')) if pd.notna(row.get('prim_state')) else None,
                str(row.get('naics')) if pd.notna(row.get('naics')) else None,
                str(row.get('naics_title')) if pd.notna(row.get('naics_title')) else None,
                str(row.get('i_group')) if pd.notna(row.get('i_group')) else None,
                clean_int(row.get('own_code')),
                str(row.get('occ_code')) if pd.notna(row.get('occ_code')) else None,
                str(row.get('occ_title')) if pd.notna(row.get('occ_title')) else None,
                str(row.get('o_group')) if pd.notna(row.get('o_group')) else None,
                clean_int(row.get('tot_emp')),
                clean_numeric(row.get('emp_prse')),
                clean_numeric(row.get('jobs_1000')),
                clean_numeric(row.get('loc_quotient')),
                clean_numeric(row.get('pct_total')),
                clean_numeric(row.get('pct_rpt')),
                clean_numeric(row.get('h_mean')),
                clean_numeric(row.get('a_mean')),
                clean_numeric(row.get('mean_prse')),
                clean_numeric(row.get('h_pct10')),
                clean_numeric(row.get('h_pct25')),
                clean_numeric(row.get('h_median')),
                clean_numeric(row.get('h_pct75')),
                clean_numeric(row.get('h_pct90')),
                clean_numeric(row.get('a_pct10')),
                clean_numeric(row.get('a_pct25')),
                clean_numeric(row.get('a_median')),
                clean_numeric(row.get('a_pct75')),
                clean_numeric(row.get('a_pct90')),
                clean_numeric(row.get('annual')),
                clean_numeric(row.get('hourly')),
                2024
            ))
        
        query = '''
            INSERT INTO salaries 
            (area, area_title, area_type, prim_state, naics, naics_title, i_group, own_code, 
             occ_code, occ_title, o_group, tot_emp, emp_prse, jobs_1000, loc_quotient, 
             pct_total, pct_rpt, h_mean, a_mean, mean_prse, h_pct10, h_pct25, h_median, 
             h_pct75, h_pct90, a_pct10, a_pct25, a_median, a_pct75, a_pct90, annual, hourly, year)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (occ_code, area, naics, own_code) DO NOTHING
        '''
        
        from psycopg2.extras import execute_batch
        
        batch_size = 10000
        for start in range(0, len(values), batch_size):
            end = min(start + batch_size, len(values))
            batch = values[start:end]
            execute_batch(cursor, query, batch)
            conn.commit()
            log(f"    Loaded {end} rows...")
            
    except Exception as e:
        log(f"  Error: {e}")
    finally:
        cursor.close()
        conn.close()

def main():
    log("=" * 60)
    log("Loading data into PostgreSQL database: careerality")
    log("=" * 60)
    log("")
    
    load_salaries()
    log("")
    
    load_bls_state_wages()
    log("")
    
    load_education_data()
    log("")
    
    load_salary_reference_data()
    log("")
    
    load_onet_data()
    log("")
    
    load_onet_education()
    log("")
    
    load_onet_soc_crosswalk()
    log("")
    
    load_cip_soc_crosswalk()
    log("")
    
    load_onet_cip_crosswalk()
    log("")
    
    load_ipeds_completions()
    log("")
    
    load_cost_of_living()
    log("")
    
    load_state_employment_projections()
    log("")
    
    log("=" * 60)
    log("Data loading complete!")
    log("=" * 60)
    
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT 'salaries' as table_name, COUNT(*) FROM salaries
        UNION ALL SELECT 'student_financial_aid', COUNT(*) FROM student_financial_aid
        UNION ALL SELECT 'institutions', COUNT(*) FROM institutions
        UNION ALL SELECT 'institutional_characteristics', COUNT(*) FROM institutional_characteristics
        UNION ALL SELECT 'salary_occupations', COUNT(*) FROM salary_occupations
        UNION ALL SELECT 'salary_areas', COUNT(*) FROM salary_areas
        UNION ALL SELECT 'salary_industries', COUNT(*) FROM salary_industries
        UNION ALL SELECT 'salary_datatypes', COUNT(*) FROM salary_datatypes
        UNION ALL SELECT 'salary_sector', COUNT(*) FROM salary_sector
        UNION ALL SELECT 'cost_of_living', COUNT(*) FROM cost_of_living
        UNION ALL SELECT 'onet_data', COUNT(*) FROM onet_data
        UNION ALL SELECT 'state_employment_projections', COUNT(*) FROM state_employment_projections
    """)
    log("\nTable summary:")
    for row in cursor.fetchall():
        log(f"  {row[0]}: {row[1]} rows")
    cursor.close()
    conn.close()

if __name__ == '__main__':
    main()
