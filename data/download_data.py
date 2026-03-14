"""
Data Download Script for Careerality Backend

This script handles downloading data from public sources for career exploration.
See README.md for data sources and licensing information.

Downloaded Data:
---------------
1. O*NET Database 30.2 (downloaded): 
   - Location: data/careers/onetsql/db_30_2_text/
   - Contains: Occupation data, skills, abilities, knowledge, tasks, work context,
     education requirements, job zones, interests, work activities, technology skills
   - Source: https://www.onetcenter.org/database.html
   - License: Creative Commons Attribution 4.0

2. BLS Occupational Employment and Wage Statistics (OEWS):
   - Requires API key registration at https://data.bls.gov/registrationEngine/
   - Alternative: Download from https://www.bls.gov/oes/tables.htm
   - Series IDs follow format: OE + U + areatype + area_code + industry + occupation + datatype

3. IPEDS Education Data:
   - See: https://nces.ed.gov/ipeds/datacenter/
   - Alternative: https://github.com/paulgp/ipeds-database (DuckDB wrapper)

4. EPI Family Budget Calculator:
   - Download: https://www.epi.org/resources/datazone_fambud_xls_index/
   - Note: Data appears to be from 2007/2008 - may need more recent source
"""

import os
import json

def get_downloaded_data_info():
    """Return info about downloaded data files."""
    base_path = os.path.dirname(os.path.abspath(__file__))
    repo_root = os.path.dirname(base_path)
    
    info = {
        "onet": {
            "location": "data/careers/onetsql/db_30_2_text/",
            "files": [],
            "source": "https://www.onetcenter.org/database.html",
            "version": "30.2",
            "description": "O*NET occupational database with skills, abilities, knowledge, tasks, etc."
        }
    }
    
    onet_path = os.path.join(repo_root, "data/careers/onetsql/db_30_2_text")
    if os.path.exists(onet_path):
        info["onet"]["files"] = [f for f in os.listdir(onet_path) if f.endswith(".txt")]
    
    return info

def list_occupation_data():
    """Show what's available in the downloaded O*NET data."""
    info = get_downloaded_data_info()
    
    print("=== Downloaded Data for Careerality ===\n")
    print(f"O*NET Database v{info['onet']['version']}")
    print(f"Source: {info['onet']['source']}")
    print(f"Files: {len(info['onet']['files'])}")
    print("\nKey files:")
    
    key_files = [
        ("Occupation Data.txt", "Occupation titles, codes, descriptions"),
        ("Job Zones.txt", "Education/training level requirements"),
        ("Skills.txt", "Required skills by occupation"),
        ("Abilities.txt", "Required abilities by occupation"),
        ("Knowledge.txt", "Required knowledge by occupation"),
        ("Task Statements.txt", "Task statements by occupation"),
        ("Work Context.txt", "Work environment details"),
        ("Education, Training, and Experience.txt", "Education requirements"),
        ("Interests.txt", "RIASEC interest profiles"),
        ("Technology Skills.txt", "Technology tools used"),
    ]
    
    for filename, desc in key_files:
        if filename in info['onet']['files']:
            print(f"  ✓ {filename}: {desc}")
        else:
            print(f"  ✗ {filename}: {desc}")

if __name__ == "__main__":
    list_occupation_data()