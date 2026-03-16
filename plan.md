# Plan: Add Missing Data Sources for Indeed-Style Rankings

## Background

The Indeed 2026 Best Jobs rankings use 5 metrics:
1. Median annual salary - ✅ Have BLS data
2. Job postings per million - ❌ Missing
3. Remote work % - ❌ Missing
4. Wage growth (3-year) - ❌ Missing
5. Job posting growth (3-year) - ❌ Missing

## Missing Data Sources

| Metric | Source | Free? | Status |
|--------|--------|-------|--------|
| Job posting volume | CareerOneStop API | Yes | Not integrated |
| Remote work % | None free | No | No source |
| Wage growth | BLS Historical OES | Yes | Need 3+ years |
| Posting growth | CareerOneStop + time-series | Yes | Not implemented |

## Implementation

### 1. CareerOneStop Job Postings API (Free)
- Register at https://careeronestop.org/Developers/
- Use `/jobs/list-jobs-v2` to get posting counts by occupation (O*NET SOC code)
- Store results for volume metrics
- Query monthly to track growth over time

**Endpoint**: `https://api.careeronestop.org/v2/jobsearch/{userId}/{keyword}/{location}...`

### 2. BLS Historical Wage Data (Free)
- BLS Public API: https://data.bls.gov/developer/
- Query OES historical data by occupation
- Store 3+ years to compute wage growth trends
- Expand existing schema for time-series storage

**API limits**: 500 queries/day, 20 years, 50 series per request

### 3. Remote Work Data
- No free comprehensive source
- Workaround: Use "telecommute" keyword frequency in job postings as proxy

### 4. Data Pipeline Changes
- Add table: `job_postings` (occupation, area, count, date)
- Add table: `historical_salaries` (occ_code, year, median_wage)
- Create: `data/fetch_careeronestop.py`
- Create: `data/fetch_bls_history.py`
- Update ranking algorithm
