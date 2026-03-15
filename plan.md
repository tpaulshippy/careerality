# ROI Data Fix Plan

## Issues Found (2026-03-15)

### Critical Issues

| Issue | Severity | Details |
|-------|----------|---------|
| Regional cost of living NOT applied | **Critical** | `cost_of_living_index` is always 100.00 for all 243K records. `adjusted_salary` equals `annual_median_salary` — no regional adjustment. `career_cost_of_living` table has correct data (DC=141, CA=127) but not joined. |
| adjusted_salary not calculated | **Critical** | All 243,175 records have `adjusted_salary = annual_median_salary` - the regional adjustment formula is not being applied |

### Moderate Issues

| Issue | Severity | Details |
|-------|----------|---------|
| Skills 82% populated | **Medium** | Only 198,670/243,175 (82%) have skills. Remaining ~44K records have NULL skills. |
| industry_code/industry_name empty | **Medium** | Phase 5 in old plan was marked "CANNOT FIX" - source data issue |

### Working Correctly ✅

- Salary data: 243K records, median ~$59K (matches BLS benchmark)
- Education costs: 100% populated, $25K-$91K range
- Breakeven: 100% populated, minimum 2 years (Phase 4 fixed)
- ROI percentage: 100% populated, capped at 5000%
- Regional salary data: 585 unique areas available

---

## Root Cause Analysis

The code that calculates ROI appears to be:
1. Not joining `career_cost_of_living` data to get regional COL indices
2. Not applying the regional adjustment formula: `adjusted_salary = annual_median_salary * (100 / cost_of_living_index)`

---

## Plan

### Phase 1: Fix Regional Cost of Living Application (Priority: Critical)

**Fix**:
1. Identify the ROI calculation code (likely in a data processing script or migration)
2. Join `career_cost_of_living` data by matching area codes between `career_roi` and `career_cost_of_living`
3. Apply regional adjustment formula: `adjusted_salary = annual_median_salary * (100 / cost_of_living_index)`
4. Update all 243K records with correct `cost_of_living_index` values

**Verification**:
- Records from DC (area_code '11') should have COL index ~141
- Records from California (area_code '06') should have COL index ~127
- Records from Alabama (area_code '01') should have COL index ~87
- `adjusted_salary` should differ from `annual_median_salary` for non-national areas

### Phase 2: Populate Remaining Skills Data (Priority: Medium)

**Current state**: 198,670/243,175 (82%) populated
**Target**: 100%

**Fix**:
1. Identify which occupations are missing skills
2. Check if source data (career_profiles) has skills for these occupations
3. Update career_roi.skills from career_profiles.skills where NULL

### Phase 3: Verify All Success Criteria (Priority: High)

| Test | Expected | Current | Status |
|------|----------|---------|--------|
| `cost_of_living_index` varies by region | Yes | Yes (86-141) | ✅ |
| `adjusted_salary != annual_median_salary` | Yes | Yes (229K/243K) | ✅ |
| `skills` populated | 100% | 82% | ⚠️ |
| `years_to_breakeven >= 2` | Yes | Yes | ✅ |
| `roi_percentage <= 5000` | Yes | Yes | ✅ |

---

## Implementation Order

```
1. Phase 1: Fix regional COL application
   - Find ROI calculation script
   - Add career_cost_of_living join
   - Apply formula to all records
   - Verify: DC=141, CA=127, AL=87
   
2. Phase 2: Populate remaining skills
   - Identify missing occupations
   - Backfill from career_profiles
   
3. Phase 3: Verify all criteria pass
   - Run verification queries
   - Confirm adjusted_salary varies
```

---

## Verification Queries

```sql
-- Check COL index variation (should show different values)
SELECT DISTINCT cost_of_living_index FROM career_roi ORDER BY cost_of_living_index;

-- Check adjusted_salary != salary (should show differences)
SELECT COUNT(*) FROM career_roi WHERE adjusted_salary != annual_median_salary;

-- Sample DC data (should show COL ~141)
SELECT occupation_name, area_name, annual_median_salary, cost_of_living_index, adjusted_salary
FROM career_roi 
WHERE area_name ILIKE '%DC%' OR area_name ILIKE '%District of Columbia%'
LIMIT 5;

-- Check skills coverage
SELECT COUNT(*) FILTER (WHERE skills IS NOT NULL AND skills != '[]'::jsonb) as populated,
       COUNT(*) as total
FROM career_roi;
```

---

## Progress

### Phase 1: ✅ COMPLETE (2026-03-15)

**Fix applied**: Modified `data/transform.py` to:
1. Add cost of living cache that maps state abbreviation to COL index
2. Query `prim_state` from salaries table
3. Apply formula: `adjusted_salary = annual_median_salary * (100 / cost_of_living_index)`

**Verification results**:
- DC: COL index 140.81 (expected ~141) ✅
- California: COL index 127.43 (expected ~127) ✅
- Alabama: COL index 86.91 (expected ~87) ✅
- 229,244/243,175 records now have `adjusted_salary != annual_median_salary` ✅

### Phase 2: Populate remaining skills data  
### Phase 3: Verify all success criteria pass
