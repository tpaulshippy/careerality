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
    - Download flat files from https://www.bls.gov/oes/tables.htm
    - Series IDs follow format: OE + U + areatype + area_code + industry + occupation + datatype

3. IPEDS Education Data:
   - See: https://nces.ed.gov/ipeds/datacenter/
   - Alternative: https://github.com/paulgp/ipeds-database (DuckDB wrapper)

4. EPI Family Budget Calculator:
   - Download: https://www.epi.org/resources/datazone_fambud_xls_index/
   - Note: Data appears to be from 2007/2008 - may need more recent source
"""

import os
import sys
import argparse
import urllib.request
import zipfile

ONET_VERSION = "30.2"
ONET_ZIP_URL = f"https://www.onetcenter.org/dl_files/database/db_{ONET_VERSION.replace('.', '_')}_text.zip"


def download_file(url, dest_path, retries=3):
    """Download a single file with retry logic."""
    for attempt in range(retries):
        try:
            urllib.request.urlretrieve(url, dest_path)
            return True
        except Exception as e:
            if attempt < retries - 1:
                print(f"  Retry {attempt + 1}/{retries} for {url}: {e}")
            else:
                print(f"  Failed to download {url}: {e}")
                return False
    return False


def download_data(base_path):
    """Download O*NET database files."""
    script_dir = os.path.dirname(os.path.abspath(base_path))
    repo_root = os.path.dirname(script_dir)
    onet_path = os.path.join(repo_root, f"data/careers/onetsql/db_{ONET_VERSION.replace('.', '_')}_text")
    
    os.makedirs(onet_path, exist_ok=True)
    
    zip_path = os.path.join(onet_path, f"db_{ONET_VERSION.replace('.', '_')}_text.zip")
    
    if os.path.exists(zip_path):
        print(f"O*NET v{ONET_VERSION} ZIP already exists at {zip_path}")
    else:
        print(f"Downloading O*NET v{ONET_VERSION} from {ONET_ZIP_URL}")
        print(f"Saving to {zip_path}\n")
        success = download_file(ONET_ZIP_URL, zip_path)
        if not success:
            print("Failed to download O*NET data")
            return False
    
    print(f"\nExtracting {zip_path}...")
    try:
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(onet_path)
        os.remove(zip_path)
        
        inner_dir = os.path.join(onet_path, f"db_{ONET_VERSION.replace('.', '_')}_text")
        if os.path.exists(inner_dir):
            for f in os.listdir(inner_dir):
                src = os.path.join(inner_dir, f)
                dst = os.path.join(onet_path, f)
                os.rename(src, dst)
            os.rmdir(inner_dir)
        
        print("Extraction complete!")
    except Exception as e:
        print(f"Failed to extract: {e}")
        return False
    
    extracted_files = [f for f in os.listdir(onet_path) if f.endswith('.txt')]
    print(f"Extracted {len(extracted_files)} files")
    return True


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
    parser = argparse.ArgumentParser(description="O*NET Data Downloader for Careerality")
    parser.add_argument("--download", action="store_true", help="Download O*NET data from onetcenter.org")
    args = parser.parse_args()
    
    if args.download:
        download_data(__file__)
    else:
        list_occupation_data()