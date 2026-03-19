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
    - Note: For annual OES data, manually download from:
      https://www.bls.gov/oes/special-requests/oesm24all.zip
      and extract all_data_M_2024.xlsx to data/salary/oesm24all/

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

5. O*NET CIP to O*NET-SOC Crosswalk:
     - Location: data/education/
     - Contains: Mapping between CIP education codes and O*NET-SOC occupation codes
     - Source: https://www.onetcenter.org/crosswalks/cip/Education_CIP_to_ONET_SOC.xlsx
     - License: Creative Commons Attribution 4.0

6. Projections Central State Employment Projections:
     - Location: data/projections/
     - Contains: State-level employment projections (long-term 10-year and short-term 2-year)
       with projected growth, job openings by occupation and state
     - Source: https://public.projectionscentral.org/Projections/LongTermRestJson
     - License: Public Domain (US Department of Labor)
"""

import os
import sys
import re
import argparse
import urllib.request
import zipfile
import io
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

IPEDS_COST_URL = "https://nces.ed.gov/ipeds/data-generator?year=2024&tableName={}&HasRV=0&type=csv"
IPEDS_COST_FILES = ["COST1_2024", "COST2_2024"]

EPI_COST_OF_LIVING_URL = "https://files.epi.org/uploads/fbc_data_2026.xlsx"

BLS_OEWS_STATE_URL = "https://www.bls.gov/oes/special.requests/oesm24st.zip"
ONET_EDUCATION_URL = "https://www.onetcenter.org/dl_files/database/db_29_0_excel/Education%2C%20Training%2C%20and%20%20Experience.xlsx"
ONET_SOC_CROSSWALK_URL = "https://www.onetcenter.org/taxonomy/2019/list/2019_Crosswalk_ONET_SOC_2019_to_SOC_2018.xlsx"
CIP_SOC_CROSSWALK_URL = "https://nces.ed.gov/ipeds/cipcode/resources.aspx"

ONET_CIP_CROSSWALK_URL = "https://www.onetcenter.org/crosswalks/cip/Education_CIP_to_ONET_SOC.xlsx"

PROJECTIONS_LONG_TERM_JSON_URL = "https://public.projectionscentral.org/Projections/LongTermRestJson"
PROJECTIONS_SHORT_TERM_JSON_URL = "https://public.projectionscentral.org/Projections/ShortTermRestJson"

STATE_FIPS_CODES = {
    '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO', '09': 'CT', '10': 'DE',
    '11': 'DC', '12': 'FL', '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL', '18': 'IN', '19': 'IA',
    '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME', '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN',
    '28': 'MS', '29': 'MO', '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH', '34': 'NJ', '35': 'NM',
    '36': 'NY', '37': 'NC', '38': 'ND', '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI',
    '45': 'SC', '46': 'SD', '47': 'TN', '48': 'TX', '49': 'UT', '50': 'VT', '51': 'VA', '53': 'WA',
    '54': 'WV', '55': 'WI', '56': 'WY', '72': 'PR'
}


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
    """Download BLS Occupational Employment and Wage Statistics data.
    
    Note: For annual OES data (oesm24all), download manually from:
    https://www.bls.gov/oes/special-requests/oesm24all.zip
    and extract all_data_M_2024.xlsx to data/salary/oesm24all/
    """
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


def download_ipeds_cost_data(base_path):
    """Download IPEDS Cost data (tuition) from NCES."""
    script_dir = os.path.dirname(os.path.abspath(base_path))
    repo_root = os.path.dirname(script_dir)
    ipeds_path = os.path.join(repo_root, "data/education")
    
    os.makedirs(ipeds_path, exist_ok=True)
    
    print(f"\nDownloading IPEDS Cost data to {ipeds_path}\n")
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    
    for filename in IPEDS_COST_FILES:
        dest_path = os.path.join(ipeds_path, f"{filename}.csv")
        
        if os.path.exists(dest_path):
            print(f"  {filename}: already exists, skipping")
            continue
        
        url = IPEDS_COST_URL.format(filename)
        print(f"  Downloading {filename}...", end=" ", flush=True)
        
        try:
            request = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(request) as response:
                content = response.read()
                if content.startswith(b'PK'):
                    zip_file = io.BytesIO(content)
                    with zipfile.ZipFile(zip_file, 'r') as zf:
                        csv_name = [f for f in zf.namelist() if f.endswith('.csv')][0]
                        with open(dest_path, 'wb') as f:
                            f.write(zf.read(csv_name))
                    size = os.path.getsize(dest_path)
                    print(f"OK ({size:,} bytes)")
                else:
                    print(f"FAILED: Unexpected content type")
        except Exception as e:
            print(f"FAILED: {e}")
    
    print("\nIPEDS Cost data download complete!")
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


def download_projections_data(base_path):
    """Download state employment projections data from Projections Central."""
    import json
    
    script_dir = os.path.dirname(os.path.abspath(base_path))
    repo_root = os.path.dirname(script_dir)
    proj_path = os.path.join(repo_root, "data/projections")
    
    os.makedirs(proj_path, exist_ok=True)
    
    print(f"Downloading state employment projections to {proj_path}\n")
    
    all_projections = {'long_term': [], 'short_term': []}
    
    for fips_code in STATE_FIPS_CODES.keys():
        state_abbr = STATE_FIPS_CODES[fips_code]
        
        print(f"  Downloading Long-Term for {state_abbr}...", end=" ", flush=True)
        
        url = f"{PROJECTIONS_LONG_TERM_JSON_URL}/{fips_code}"
        
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
            request = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(request, timeout=60) as response:
                data = json.loads(response.read().decode('utf-8'))
                rows = data.get('rows', [])
                
                for row in rows:
                    all_projections['long_term'].append({
                        'state_fips': fips_code,
                        'state_abbr': state_abbr,
                        'occ_code': row.get('OccCode'),
                        'title': row.get('Title'),
                        'base_employment': row.get('Base'),
                        'projected_employment': row.get('Projected'),
                        'change': row.get('Change'),
                        'percent_change': row.get('PercentChange'),
                        'avg_annual_openings': row.get('AvgAnnualOpenings'),
                        'base_year': row.get('BaseYear'),
                        'proj_year': row.get('ProjYear'),
                        'projection_type': 'long_term'
                    })
                print(f"OK ({len(rows)} occupations)")
        except Exception as e:
            print(f"FAILED: {e}")
        
        print(f"  Downloading Short-Term for {state_abbr}...", end=" ", flush=True)
        
        url = f"{PROJECTIONS_SHORT_TERM_JSON_URL}/{fips_code}"
        
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
            request = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(request, timeout=60) as response:
                data = json.loads(response.read().decode('utf-8'))
                rows = data.get('rows', [])
                
                for row in rows:
                    all_projections['short_term'].append({
                        'state_fips': fips_code,
                        'state_abbr': state_abbr,
                        'occ_code': row.get('OccCode'),
                        'title': row.get('Title'),
                        'base_employment': row.get('Base'),
                        'projected_employment': row.get('Projected'),
                        'change': row.get('Change'),
                        'percent_change': row.get('PercentChange'),
                        'avg_annual_openings': row.get('AvgAnnualOpenings'),
                        'base_year': row.get('BaseYear'),
                        'proj_year': row.get('ProjYear'),
                        'projection_type': 'short_term'
                    })
                print(f"OK ({len(rows)} occupations)")
        except Exception as e:
            print(f"FAILED: {e}")
    
    national_long_url = PROJECTIONS_LONG_TERM_JSON_URL
    print(f"  Downloading Long-Term National...", end=" ", flush=True)
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        request = urllib.request.Request(national_long_url, headers=headers)
        with urllib.request.urlopen(request, timeout=60) as response:
            data = json.loads(response.read().decode('utf-8'))
            rows = data.get('rows', [])
            
            for row in rows:
                all_projections['long_term'].append({
                    'state_fips': '00',
                    'state_abbr': 'US',
                    'occ_code': row.get('OccCode'),
                    'title': row.get('Title'),
                    'base_employment': row.get('Base'),
                    'projected_employment': row.get('Projected'),
                    'change': row.get('Change'),
                    'percent_change': row.get('PercentChange'),
                    'avg_annual_openings': row.get('AvgAnnualOpenings'),
                    'base_year': row.get('BaseYear'),
                    'proj_year': row.get('ProjYear'),
                    'projection_type': 'long_term'
                })
            print(f"OK ({len(rows)} occupations)")
    except Exception as e:
        print(f"FAILED: {e}")
    
    national_short_url = PROJECTIONS_SHORT_TERM_JSON_URL
    print(f"  Downloading Short-Term National...", end=" ", flush=True)
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        request = urllib.request.Request(national_short_url, headers=headers)
        with urllib.request.urlopen(request, timeout=60) as response:
            data = json.loads(response.read().decode('utf-8'))
            rows = data.get('rows', [])
            
            for row in rows:
                all_projections['short_term'].append({
                    'state_fips': '00',
                    'state_abbr': 'US',
                    'occ_code': row.get('OccCode'),
                    'title': row.get('Title'),
                    'base_employment': row.get('Base'),
                    'projected_employment': row.get('Projected'),
                    'change': row.get('Change'),
                    'percent_change': row.get('PercentChange'),
                    'avg_annual_openings': row.get('AvgAnnualOpenings'),
                    'base_year': row.get('BaseYear'),
                    'proj_year': row.get('ProjYear'),
                    'projection_type': 'short_term'
                })
            print(f"OK ({len(rows)} occupations)")
    except Exception as e:
        print(f"FAILED: {e}")
    
    long_term_file = os.path.join(proj_path, "state_employment_projections_long_term.json")
    short_term_file = os.path.join(proj_path, "state_employment_projections_short_term.json")
    
    with open(long_term_file, 'w') as f:
        json.dump(all_projections['long_term'], f, indent=2)
    
    with open(short_term_file, 'w') as f:
        json.dump(all_projections['short_term'], f, indent=2)
    
    print(f"\nProjections data download complete!")
    print(f"  Long-term: {len(all_projections['long_term'])} records")
    print(f"  Short-term: {len(all_projections['short_term'])} records")
    return True


def download_bls_state_oes_data(base_path):
    """Download BLS OEWS state-level data."""
    script_dir = os.path.dirname(os.path.abspath(base_path))
    repo_root = os.path.dirname(script_dir)
    bls_path = os.path.join(repo_root, "data/salary")
    
    os.makedirs(bls_path, exist_ok=True)
    
    zip_path = os.path.join(bls_path, "oesm24st.zip")
    extract_dir = os.path.join(bls_path, "oesm24st")
    
    print(f"Downloading BLS OEWS state data to {bls_path}\n")
    
    if os.path.exists(extract_dir) and os.listdir(extract_dir):
        print(f"  State OEWS data already extracted, skipping")
        return True
    
    if not os.path.exists(zip_path):
        print(f"  Downloading BLS state OEWS data...", end=" ", flush=True)
        
        if download_file(BLS_OEWS_STATE_URL, zip_path):
            size = os.path.getsize(zip_path)
            print(f"OK ({size:,} bytes)")
        else:
            print(f"FAILED")
            return False
    
    print(f"  Extracting {zip_path}...", end=" ", flush=True)
    try:
        os.makedirs(extract_dir, exist_ok=True)
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(extract_dir)
        os.remove(zip_path)
        
        for f in os.listdir(extract_dir):
            if f.endswith('.xlsx') or f.endswith('.xls'):
                print(f"OK (found {f})")
                break
        else:
            print("OK")
        
        return True
    except Exception as e:
        print(f"FAILED: {e}")
        return False


def download_onet_education_data(base_path):
    """Download O*NET Education, Training & Experience data."""
    script_dir = os.path.dirname(os.path.abspath(base_path))
    repo_root = os.path.dirname(script_dir)
    onet_path = os.path.join(repo_root, "data/careers/onetsql")
    
    os.makedirs(onet_path, exist_ok=True)
    
    dest_path = os.path.join(onet_path, "Education_Training_and_Experience.xlsx")
    
    print(f"Downloading O*NET Education data to {onet_path}\n")
    
    if os.path.exists(dest_path):
        print(f"  O*NET Education data already exists, skipping")
        return True
    
    print(f"  Downloading O*NET Education, Training & Experience...", end=" ", flush=True)
    
    if download_file(ONET_EDUCATION_URL, dest_path):
        size = os.path.getsize(dest_path)
        print(f"OK ({size:,} bytes)")
        return True
    else:
        print(f"FAILED")
        return False


def download_onet_soc_crosswalk(base_path):
    """Download O*NET-SOC to SOC 2018 crosswalk."""
    script_dir = os.path.dirname(os.path.abspath(base_path))
    repo_root = os.path.dirname(script_dir)
    onet_path = os.path.join(repo_root, "data/careers/onetsql")
    
    os.makedirs(onet_path, exist_ok=True)
    
    dest_path = os.path.join(onet_path, "onet_soc_2019_to_soc_2018_crosswalk.xlsx")
    
    print(f"Downloading O*NET SOC crosswalk to {onet_path}\n")
    
    if os.path.exists(dest_path):
        print(f"  O*NET SOC crosswalk already exists, skipping")
        return True
    
    print(f"  Downloading O*NET-SOC to SOC 2018 crosswalk...", end=" ", flush=True)
    
    if download_file(ONET_SOC_CROSSWALK_URL, dest_path):
        size = os.path.getsize(dest_path)
        print(f"OK ({size:,} bytes)")
        return True
    else:
        print(f"FAILED")
        return False


def download_cip_soc_crosswalk(base_path):
    """Download CIP to SOC crosswalk from BLS."""
    script_dir = os.path.dirname(os.path.abspath(base_path))
    repo_root = os.path.dirname(script_dir)
    cip_path = os.path.join(repo_root, "data/education")
    
    os.makedirs(cip_path, exist_ok=True)
    
    dest_path = os.path.join(cip_path, "soc_2018_to_cip2020_crosswalk.xlsx")
    
    print(f"Downloading CIP-SOC crosswalk to {cip_path}\n")
    
    BLS_SOC_CIP_URL = "https://www.bls.gov/soc/soccrosswalks.xlsx"
    
    if os.path.exists(dest_path):
        print(f"  CIP-SOC crosswalk already exists, skipping")
        return True
    
    print(f"  Downloading CIP to SOC crosswalk...", end=" ", flush=True)
    
    if download_file(BLS_SOC_CIP_URL, dest_path):
        size = os.path.getsize(dest_path)
        print(f"OK ({size:,} bytes)")
        return True
    else:
        print(f"  Trying alternate source...")
        alt_url = "https://nces.ed.gov/ipeds/cipcode/download/2020-CIP-to-SOC.xlsx"
        if download_file(alt_url, dest_path):
            size = os.path.getsize(dest_path)
            print(f"OK ({size:,} bytes)")
            return True
        print(f"FAILED")
        return False


def download_onet_cip_crosswalk(base_path):
    """Download O*NET CIP to O*NET-SOC crosswalk."""
    script_dir = os.path.dirname(os.path.abspath(base_path))
    repo_root = os.path.dirname(script_dir)
    cip_path = os.path.join(repo_root, "data/education")
    
    os.makedirs(cip_path, exist_ok=True)
    
    dest_path = os.path.join(cip_path, "Education_CIP_to_ONET_SOC.xlsx")
    
    print(f"Downloading O*NET CIP crosswalk to {cip_path}\n")
    
    if os.path.exists(dest_path):
        print(f"  O*NET CIP crosswalk already exists, skipping")
        return True
    
    print(f"  Downloading O*NET CIP to O*NET-SOC crosswalk...", end=" ", flush=True)
    
    if download_file(ONET_CIP_CROSSWALK_URL, dest_path):
        size = os.path.getsize(dest_path)
        print(f"OK ({size:,} bytes)")
        return True
    else:
        print(f"FAILED")
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
    print("  Note: For annual OES data, manually download from:")
    print("        https://www.bls.gov/oes/special-requests/oesm24all.zip")
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
    parser.add_argument("--download-bls-state", action="store_true", help="Download BLS OEWS state-level data")
    parser.add_argument("--download-ipeds", action="store_true", help="Download IPEDS education data from nces.ed.gov")
    parser.add_argument("--download-ipeds-cost", action="store_true", help="Download IPEDS Cost data (tuition) from nces.ed.gov")
    parser.add_argument("--download-onet-education", action="store_true", help="Download O*NET Education, Training & Experience data")
    parser.add_argument("--download-onet-crosswalk", action="store_true", help="Download O*NET-SOC to SOC crosswalk")
    parser.add_argument("--download-cip-crosswalk", action="store_true", help="Download CIP to SOC crosswalk")
    parser.add_argument("--download-onet-cip-crosswalk", action="store_true", help="Download O*NET CIP to O*NET-SOC crosswalk")
    parser.add_argument("--download-epi", action="store_true", help="Download EPI cost of living data from files.epi.org")
    parser.add_argument("--download-projections", action="store_true", help="Download state employment projections from projectionscentral.org")
    parser.add_argument("--download-all", action="store_true", help="Download all available data sources")
    args = parser.parse_args()
    
    if args.download_all:
        print("Downloading all data sources...\n")
        print("="*50)
        print("O*NET Data")
        print("="*50)
        download_data(__file__)
        print("\n" + "="*50)
        print("O*NET Education Data")
        print("="*50)
        download_onet_education_data(__file__)
        print("\n" + "="*50)
        print("O*NET SOC Crosswalk")
        print("="*50)
        download_onet_soc_crosswalk(__file__)
        print("\n" + "="*50)
        print("BLS OEWS Data")
        print("="*50)
        download_bls_data(__file__)
        print("\n" + "="*50)
        print("BLS State OEWS Data")
        print("="*50)
        download_bls_state_oes_data(__file__)
        print("\n" + "="*50)
        print("IPEDS Education Data")
        print("="*50)
        download_ipeds_data(__file__)
        print("\n" + "="*50)
        print("CIP-SOC Crosswalk")
        print("="*50)
        download_cip_soc_crosswalk(__file__)
        print("\n" + "="*50)
        print("O*NET CIP Crosswalk")
        print("="*50)
        download_onet_cip_crosswalk(__file__)
        print("\n" + "="*50)
        print("EPI Cost of Living Data")
        print("="*50)
        download_cost_of_living_data(__file__)
        print("\n" + "="*50)
        print("Projections Central State Employment Projections")
        print("="*50)
        download_projections_data(__file__)
    elif args.download_epi:
        download_cost_of_living_data(__file__)
    elif args.download_projections:
        download_projections_data(__file__)
    elif args.download_ipeds:
        download_ipeds_data(__file__)
    elif args.download_ipeds_cost:
        download_ipeds_cost_data(__file__)
    elif args.download_bls:
        download_bls_data(__file__)
    elif args.download_bls_state:
        download_bls_state_oes_data(__file__)
    elif args.download_onet:
        download_data(__file__)
    elif args.download_onet_education:
        download_onet_education_data(__file__)
    elif args.download_onet_crosswalk:
        download_onet_soc_crosswalk(__file__)
    elif args.download_cip_crosswalk:
        download_cip_soc_crosswalk(__file__)
    elif args.download_onet_cip_crosswalk:
        download_onet_cip_crosswalk(__file__)
    else:
        list_occupation_data()