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
   - Location: data/salary/
   - Contains: Employment and wage data by occupation and area
   - Source: https://download.bls.gov/pub/time.series/oe/
   - License: Public Domain

3. IPEDS Education Data:
   - Location: data/education/
   - Contains: Institutional characteristics, admissions, completions, enrollment,
     graduation rates, student financial aid, and more
   - Source: https://nces.ed.gov/ipeds/datacenter/
   - License: Public Domain

4. EPI Family Budget Calculator:
    - Location: data/cost-of-living/
    - Contains: Cost of living data by metro area and family type
    - Source: https://files.epi.org/uploads/fbc_data_2026.xlsx
    - License: Used with permission from Economic Policy Institute
"""

import os
import sys
import argparse
import urllib.request
import zipfile
from urllib.error import URLError, HTTPError

ONET_VERSION = "30.2"
ONET_ZIP_URL = f"https://www.onetcenter.org/dl_files/database/db_{ONET_VERSION.replace('.', '_')}_text.zip"

BLS_OE_BASE_URL = "https://download.bls.gov/pub/time.series/oe/"
BLS_OE_FILES = [
    "oe.area",
    "oe.areatype",
    "oe.datatype",
    "oe.footnote",
    "oe.industry",
    "oe.occupation",
    "oe.sector",
    "oe.seasonal",
    "oe.data.0.Current",
]

IPEDS_BASE_URL = "https://nces.ed.gov/ipeds/datacenter/data/"
IPEDS_KEY_FILES = [
    "HD2023",
    "IC2023",
    "ADM2023",
    "C2023_A",
    "EF2022A",
    "GR2023",
    "SFA2223",
]

EPI_COST_OF_LIVING_URL = "https://files.epi.org/uploads/fbc_data_2026.xlsx"


def download_file(url, dest_path, retries=3):
    """Download a single file with retry logic."""
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    
    for attempt in range(retries):
        try:
            request = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(request) as response:
                with open(dest_path, 'wb') as out_file:
                    out_file.write(response.read())
            return True
        except Exception as e:
            if attempt < retries - 1:
                print(f"  Retry {attempt + 1}/{retries} for {url}: {e}")
            else:
                print(f"  Failed to download {url}: {e}")
                return False
    return False


def download_bls_data(base_path):
    """Download BLS Occupational Employment and Wage Statistics data."""
    script_dir = os.path.dirname(os.path.abspath(base_path))
    repo_root = os.path.dirname(script_dir)
    bls_path = os.path.join(repo_root, "data/salary")
    
    os.makedirs(bls_path, exist_ok=True)
    
    print(f"Downloading BLS OE data to {bls_path}\n")
    
    for filename in BLS_OE_FILES:
        dest_path = os.path.join(bls_path, filename)
        
        if os.path.exists(dest_path):
            print(f"  {filename}: already exists, skipping")
            continue
        
        url = BLS_OE_BASE_URL + filename
        print(f"  Downloading {filename}...", end=" ", flush=True)
        
        if download_file(url, dest_path):
            size = os.path.getsize(dest_path)
            print(f"OK ({size:,} bytes)")
        else:
            print(f"FAILED")
            if os.path.exists(dest_path):
                os.remove(dest_path)
    
    print("\nBLS OE data download complete!")
    return True


def download_ipeds_data(base_path):
    """Download IPEDS education data from NCES."""
    script_dir = os.path.dirname(os.path.abspath(base_path))
    repo_root = os.path.dirname(script_dir)
    ipeds_path = os.path.join(repo_root, "data/education")
    
    os.makedirs(ipeds_path, exist_ok=True)
    
    print(f"Downloading IPEDS education data to {ipeds_path}\n")
    
    for filename in IPEDS_KEY_FILES:
        dest_path = os.path.join(ipeds_path, f"{filename}.zip")
        
        if os.path.exists(dest_path):
            print(f"  {filename}: already exists, skipping")
            continue
        
        url = IPEDS_BASE_URL + filename + ".zip"
        print(f"  Downloading {filename}...", end=" ", flush=True)
        
        if download_file(url, dest_path):
            size = os.path.getsize(dest_path)
            print(f"OK ({size:,} bytes)")
            
            print(f"    Extracting {filename}...", end=" ", flush=True)
            try:
                with zipfile.ZipFile(dest_path, 'r') as zip_ref:
                    zip_ref.extractall(ipeds_path)
                os.remove(dest_path)
                print("OK")
            except Exception as e:
                print(f"FAILED: {e}")
        else:
            print(f"FAILED")
            if os.path.exists(dest_path):
                os.remove(dest_path)
    
    print("\nIPEDS education data download complete!")
    return True


def download_cost_of_living_data(base_path):
    """Download EPI Family Budget Calculator cost of living data."""
    script_dir = os.path.dirname(os.path.abspath(base_path))
    repo_root = os.path.dirname(script_dir)
    col_path = os.path.join(repo_root, "data/cost-of-living")
    
    os.makedirs(col_path, exist_ok=True)
    
    filename = "fbc_data_2026.xlsx"
    dest_path = os.path.join(col_path, filename)
    
    print(f"Downloading EPI cost of living data to {col_path}\n")
    
    if os.path.exists(dest_path):
        print(f"  {filename}: already exists, skipping")
    else:
        print(f"  Downloading {filename}...", end=" ", flush=True)
        
        if download_file(EPI_COST_OF_LIVING_URL, dest_path):
            size = os.path.getsize(dest_path)
            print(f"OK ({size:,} bytes)")
        else:
            print(f"FAILED")
            if os.path.exists(dest_path):
                os.remove(dest_path)
            return False
    
    print("\nCost of living data download complete!")
    return True


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
        },
        "bls": {
            "location": "data/salary/",
            "files": [],
            "source": "https://download.bls.gov/pub/time.series/oe/",
            "description": "BLS Occupational Employment and Wage Statistics (OEWS)"
        },
        "ipeds": {
            "location": "data/education/",
            "files": [],
            "source": "https://nces.ed.gov/ipeds/datacenter/",
            "description": "IPEDS education data (institutional characteristics, admissions, completions, etc.)"
        },
        "cost_of_living": {
            "location": "data/cost-of-living/",
            "files": [],
            "source": "https://files.epi.org/uploads/fbc_data_2026.xlsx",
            "description": "EPI Family Budget Calculator cost of living data"
        }
    }
    
    onet_path = os.path.join(repo_root, "data/careers/onetsql/db_30_2_text")
    if os.path.exists(onet_path):
        info["onet"]["files"] = [f for f in os.listdir(onet_path) if f.endswith(".txt")]
    
    bls_path = os.path.join(repo_root, "data/salary")
    if os.path.exists(bls_path):
        info["bls"]["files"] = os.listdir(bls_path)
    
    ipeds_path = os.path.join(repo_root, "data/education")
    if os.path.exists(ipeds_path):
        info["ipeds"]["files"] = os.listdir(ipeds_path)
    
    col_path = os.path.join(repo_root, "data/cost-of-living")
    if os.path.exists(col_path):
        info["cost_of_living"]["files"] = os.listdir(col_path)
    
    return info

def list_occupation_data():
    """Show what's available in the downloaded O*NET and BLS data."""
    info = get_downloaded_data_info()
    
    print("=== Downloaded Data for Careerality ===\n")
    
    print("O*NET Database")
    print(f"  Source: {info['onet']['source']}")
    print(f"  Files: {len(info['onet']['files'])}")
    print("\n  Key files:")
    
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
            print(f"    ✓ {filename}: {desc}")
        else:
            print(f"    ✗ {filename}: {desc}")
    
    print("\n" + "="*50)
    print("\nBLS OEWS Data")
    print(f"  Source: {info['bls']['source']}")
    print(f"  Files: {len(info['bls']['files'])}")
    print("\n  Key files:")
    
    bls_key_files = [
        ("oe.occupation", "Occupation codes and titles"),
        ("oe.area", "Area codes (national, state, metro)"),
        ("oe.datatype", "Data types (employment, wages)"),
        ("oe.industry", "Industry codes (NAICS)"),
        ("oe.sector", "Industry sectors"),
        ("oe.data.0.Current", "Current employment/wage data"),
    ]
    
    for filename, desc in bls_key_files:
        if filename in info['bls']['files']:
            print(f"    ✓ {filename}: {desc}")
        else:
            print(f"    ✗ {filename}: {desc}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Data Downloader for Careerality")
    parser.add_argument("--download-onet", action="store_true", help="Download O*NET data from onetcenter.org")
    parser.add_argument("--download-bls", action="store_true", help="Download BLS OEWS data from download.bls.gov")
    parser.add_argument("--download-ipeds", action="store_true", help="Download IPEDS education data from nces.ed.gov")
    parser.add_argument("--download-epi", action="store_true", help="Download EPI cost of living data from files.epi.org")
    parser.add_argument("--download-all", action="store_true", help="Download all available data sources")
    args = parser.parse_args()
    
    if args.download_all:
        print("Downloading all data sources...\n")
        print("="*50)
        print("O*NET Data")
        print("="*50)
        download_data(__file__)
        print("\n" + "="*50)
        print("BLS OEWS Data")
        print("="*50)
        download_bls_data(__file__)
        print("\n" + "="*50)
        print("IPEDS Education Data")
        print("="*50)
        download_ipeds_data(__file__)
        print("\n" + "="*50)
        print("EPI Cost of Living Data")
        print("="*50)
        download_cost_of_living_data(__file__)
    elif args.download_epi:
        download_cost_of_living_data(__file__)
    elif args.download_ipeds:
        download_ipeds_data(__file__)
    elif args.download_bls:
        download_bls_data(__file__)
    elif args.download_onet:
        download_data(__file__)
    else:
        list_occupation_data()