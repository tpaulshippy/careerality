#!/usr/bin/env python3

import psycopg2

DB_CONFIG = {
    'dbname': 'careerality',
    'user': 'postgres',
    'password': 'postgres',
    'host': 'localhost'
}

def get_connection():
    return psycopg2.connect(**DB_CONFIG)

def create_schema():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS student_financial_aid (
            id SERIAL PRIMARY KEY,
            unitid INTEGER,
            data JSONB
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS institutions (
            unitid INTEGER PRIMARY KEY,
            institution_name VARCHAR(255),
            address VARCHAR(255),
            city VARCHAR(100),
            state VARCHAR(2),
            zip VARCHAR(20),
            sector INTEGER,
            control INTEGER,
            iclevel INTEGER,
            hloffer INTEGER,
            cbsa INTEGER,
            locele INTEGER
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS institutional_characteristics (
            unitid INTEGER PRIMARY KEY,
            tuition_pl VARCHAR(10),
            room VARCHAR(1),
            room_amt NUMERIC,
            board VARCHAR(1),
            board_amt NUMERIC,
            applfee_u NUMERIC,
            year_school NUMERIC
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS salary_occupations (
            occupation_code VARCHAR(20) PRIMARY KEY,
            occupation_name VARCHAR(255),
            occupation_description TEXT,
            display_level INTEGER,
            selectable VARCHAR(1),
            sort_sequence INTEGER
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS salary_areas (
            state_code VARCHAR(2),
            area_code VARCHAR(10) PRIMARY KEY,
            areatype_code VARCHAR(1),
            area_name VARCHAR(255)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS salary_industries (
            id SERIAL PRIMARY KEY,
            industry_code VARCHAR(50),
            industry_name VARCHAR(255),
            display_level INTEGER,
            selectable VARCHAR(1),
            sort_sequence INTEGER
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS salary_datatypes (
            datatype_code VARCHAR(10) PRIMARY KEY,
            datatype_name VARCHAR(255)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS salary_sector (
            sector_code VARCHAR(10) PRIMARY KEY,
            sector_name VARCHAR(255)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS salaries (
            id SERIAL PRIMARY KEY,
            area VARCHAR,
            area_title TEXT,
            area_type INTEGER,
            prim_state VARCHAR,
            naics VARCHAR,
            naics_title TEXT,
            i_group VARCHAR,
            own_code INTEGER,
            occ_code VARCHAR,
            occ_title TEXT,
            o_group VARCHAR,
            tot_emp INTEGER,
            emp_prse NUMERIC,
            jobs_1000 NUMERIC,
            loc_quotient NUMERIC,
            pct_total NUMERIC,
            pct_rpt NUMERIC,
            h_mean NUMERIC,
            a_mean NUMERIC,
            mean_prse NUMERIC,
            h_pct10 NUMERIC,
            h_pct25 NUMERIC,
            h_median NUMERIC,
            h_pct75 NUMERIC,
            h_pct90 NUMERIC,
            a_pct10 NUMERIC,
            a_pct25 NUMERIC,
            a_median NUMERIC,
            a_pct75 NUMERIC,
            a_pct90 NUMERIC,
            annual NUMERIC,
            hourly NUMERIC,
            year INTEGER DEFAULT 2024,
            UNIQUE(occ_code, area, naics, own_code)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS onet_data (
            id SERIAL PRIMARY KEY,
            data_type VARCHAR(50),
            data JSONB
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS cost_of_living (
            id SERIAL PRIMARY KEY,
            area VARCHAR(255),
            col_index NUMERIC,
            grocery_index NUMERIC,
            housing_index NUMERIC,
            utilities_index NUMERIC,
            transportation_index NUMERIC,
            misc_index NUMERIC,
            year INTEGER,
            quarter INTEGER
        )
    """)

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
            occupation_code VARCHAR(20) UNIQUE,
            occupation_name VARCHAR(255),
            area_code VARCHAR(10),
            area_name VARCHAR(255),
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
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.commit()
    cursor.close()
    conn.close()

    print("Schema created successfully!")

if __name__ == '__main__':
    create_schema()
