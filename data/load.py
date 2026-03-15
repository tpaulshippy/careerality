#!/usr/bin/env python3

import os
import json
import sys
import numpy as np
import pandas as pd
import psycopg2
import warnings

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
    
    load_education_data()
    log("")
    
    load_salary_reference_data()
    log("")
    
    load_onet_data()
    log("")
    
    load_cost_of_living()
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
    """)
    log("\nTable summary:")
    for row in cursor.fetchall():
        log(f"  {row[0]}: {row[1]} rows")
    cursor.close()
    conn.close()

if __name__ == '__main__':
    main()
