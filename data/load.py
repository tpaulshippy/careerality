#!/usr/bin/env python3

import os
import json
import pandas as pd
import psycopg2
import warnings

warnings.filterwarnings('ignore')

DATA_DIR = os.path.dirname(__file__)

DB_CONFIG = {
    'dbname': 'careerality',
    'user': 'postgres',
    'password': 'postgres',
    'host': 'localhost'
}

def get_connection():
    return psycopg2.connect(**DB_CONFIG)

def load_csv_to_table(filepath, table_name):
    if not os.path.exists(filepath):
        print(f"    File not found: {filepath}")
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

def parse_series_id(series_id):
    if not series_id or len(series_id) < 23:
        return None, None, None, None, None
    
    try:
        area = series_id[5:12]
        industry = series_id[12:18]
        datatype = series_id[18:20]
        occupation = series_id[20:26]
        sector = series_id[26:28]
        return area, industry, datatype, occupation, sector
    except:
        return None, None, None, None, None

def load_salary_data():
    print("Loading main salary data (6M+ rows - this takes a while)...")
    
    data_file = os.path.join(DATA_DIR, 'salary', 'oe.data.0.Current')
    if not os.path.exists(data_file):
        print("  Salary data file not found")
        return
    
    conn = get_connection()
    cursor = conn.cursor()
    
    chunk_size = 50000
    total_loaded = 0
    
    try:
        for chunk in pd.read_csv(data_file, sep='\t', chunksize=chunk_size, low_memory=False):
            chunk.columns = chunk.columns.str.strip()
            
            values = []
            for _, row in chunk.iterrows():
                series_id = row.get('series_id')
                area_code, industry_code, datatype_code, occupation_code, sector_code = parse_series_id(series_id)
                
                val = row.get('value')
                if pd.isna(val):
                    val = None
                
                values.append((
                    series_id,
                    row.get('year'),
                    row.get('period'),
                    val,
                    row.get('footnote_codes'),
                    occupation_code,
                    area_code,
                    industry_code,
                    datatype_code,
                    sector_code
                ))
            
            query = '''
                INSERT INTO salary_data 
                (series_id, year, period, value, footnote_codes, occupation_code, area_code, industry_code, datatype_code, sector_code)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (series_id) DO NOTHING
            '''
            
            from psycopg2.extras import execute_batch
            execute_batch(cursor, query, values)
            conn.commit()
            
            total_loaded += len(values)
            print(f"    Loaded {total_loaded} rows...")
            
    except Exception as e:
        print(f"  Error: {e}")
    finally:
        cursor.close()
        conn.close()
    
    print(f"  Total salary data loaded: {total_loaded} rows")

def main():
    print("=" * 60)
    print("Loading data into PostgreSQL database: careerality")
    print("=" * 60)
    print()
    
    load_education_data()
    print()
    
    load_salary_reference_data()
    print()
    
    # Uncomment to load main salary data (6M+ rows - takes significant time)
    # load_salary_data()
    # print()
    
    load_onet_data()
    print()
    
    load_cost_of_living()
    print()
    
    print("=" * 60)
    print("Data loading complete!")
    print("=" * 60)
    
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT 'student_financial_aid' as table_name, COUNT(*) FROM student_financial_aid
        UNION ALL SELECT 'salary_occupations', COUNT(*) FROM salary_occupations
        UNION ALL SELECT 'salary_areas', COUNT(*) FROM salary_areas
        UNION ALL SELECT 'salary_industries', COUNT(*) FROM salary_industries
        UNION ALL SELECT 'salary_datatypes', COUNT(*) FROM salary_datatypes
        UNION ALL SELECT 'salary_sector', COUNT(*) FROM salary_sector
        UNION ALL SELECT 'salary_data', COUNT(*) FROM salary_data
        UNION ALL SELECT 'cost_of_living', COUNT(*) FROM cost_of_living
        UNION ALL SELECT 'onet_data', COUNT(*) FROM onet_data
    """)
    print("\nTable summary:")
    for row in cursor.fetchall():
        print(f"  {row[0]}: {row[1]} rows")
    cursor.close()
    conn.close()

if __name__ == '__main__':
    main()
