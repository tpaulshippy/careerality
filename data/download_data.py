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
import sys
import argparse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

ONET_VERSION = "30.2"
ONET_BASE_URL = f"https://www.onetcenter.org/dl/database/db_{ONET_VERSION.replace('.', '_')}_text/"
FILES_TO_DOWNLOAD = [
    "Abilities.txt",
    "Abilities to Work Activities.txt",
    "Abilities to Work Context.txt",
    "Alternate Titles.txt",
    "Basic Interests to RIASEC.txt",
    "Content Model Reference.txt",
    "DWA Reference.txt",
    "Education, Training, and Experience Categories.txt",
    "Education, Training, and Experience.txt",
    "Emerging Tasks.txt",
    "IWA Reference.txt",
    "Interests Illustrative Activities.txt",
    "Interests Illustrative Occupations.txt",
    "Interests.txt",
    "Job Zone Reference.txt",
    "Job Zones.txt",
    "Knowledge.txt",
    "Occupation Data.txt",
    "Occupation Level Metadata.txt",
    "Sample of Reported Titles.txt",
    "Skills.txt",
    "Task Statements.txt",
    "Task to Work Activity.txt",
    "Task to Work Context.txt",
    "Technology Skills.txt",
    "Work Activities.txt",
    "Work Context.txt",
    "Work Styles.txt",
    "Work Values.txt",
]


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


def download_data(base_path, workers=4):
    """Download O*NET database files."""
    repo_root = os.path.dirname(os.path.abspath(base_path))
    onet_path = os.path.join(repo_root, f"data/careers/onetsql/db_{ONET_VERSION}_text")
    
    os.makedirs(onet_path, exist_ok=True)
    
    print(f"Downloading O*NET v{ONET_VERSION} to {onet_path}")
    print(f"Using {workers} parallel workers\n")
    
    def download_one(filename):
        url = ONET_BASE_URL + filename
        dest = os.path.join(onet_path, filename)
        if os.path.exists(dest):
            print(f"  ✓ {filename} (already exists)")
            return filename, True
        print(f"  Downloading {filename}...", end=" ", flush=True)
        success = download_file(url, dest)
        if success:
            print("done")
        return filename, success
    
    results = []
    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {executor.submit(download_one, f): f for f in FILES_TO_DOWNLOAD}
        for future in as_completed(futures):
            results.append(future.result())
    
    succeeded = sum(1 for _, ok in results if ok)
    failed = len(results) - succeeded
    
    print(f"\nDownload complete: {succeeded} succeeded, {failed} failed")
    return failed == 0

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
    parser.add_argument("--workers", type=int, default=4, help="Number of parallel download workers")
    args = parser.parse_args()
    
    if args.download:
        download_data(__file__, workers=args.workers)
    else:
        list_occupation_data()