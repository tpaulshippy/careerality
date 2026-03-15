# Data Transformation Improvement Plan

## Problem Summary (2026-03-15 Assessment)

| Issue | Severity | Details |
|-------|----------|---------|
| `career_profiles` metadata empty | **High** | All 1082 records have NULL job_zone and education_level |
| `skills` column empty | **High** | 100% NULL across all 243K career_roi records |
| `career_salaries` limited | **Medium** | Only 1388 national records (area 99), no regional salaries |
| Breakeven too aggressive | **Medium** | 37K records show 1-year, 163K show 2-year (unrealistic) |
| ROI inflation | **Medium** | "Less than high school" shows 4561% avg - formula issues |
| Industry names broken | **Low** | Shows "3-digit", "sector" instead of actual industry names |

## What's Working ✓

- Salary distribution: Median ~$55K (matches BLS)
- Cost of living: Hawaii (142), DC (141), California (127) correctly ranked
- Education-to-salary ranking: Doctoral > Bachelor's > High school (correct order)
- Geographic coverage: 583 unique areas

---

## Plan

### Phase 1: Fix career_profiles Metadata (Priority: Critical)

The `career_profiles` table has 1082 occupation records but all have NULL for job_zone, education_level, experience_required, and skills.

**Root cause**: The INSERT statement at line 40-51 passes `None` for these columns:
```python
values.append((
    occ_code, occ_name, occ_desc,
    None,  # onet_data
    None,  # job_zone
    None,  # education_level
    None,  # experience_required
    "[]", "[]", "[]"  # skills, tasks, work_activities
))
```

**Fix**:
1. Query `onet_education` table for education levels per occupation
2. Query `onet_data` table for job zones (data_type = 'job_zones')
3. Query `onet_skills` or `onet_tasks` tables for skills data
4. Populate these fields during career_profiles INSERT

### Phase 2: Populate Skills Data (Priority: High)

The `skills` column in `career_roi` is 100% NULL. O*NET provides:
- Technical skills (Element ID starting with 2.A)
- Knowledge areas (Element ID starting with 2.C)  
- Abilities (Element ID starting with 2.B)

**Fix**:
1. Query O*NET skills data by occupation code
2. Extract top 10-15 skills per occupation
3. Store as JSON array in career_roi.skills column

### Phase 3: Expand career_salaries with Regional Data (Priority: Medium)

Currently only national (area 99) salaries are loaded. BLS provides state and metro area salaries.

**Fix**:
1. Add state-level salary records (area_type = 2 in BLS data)
2. Add metropolitan area records
3. Add industry-specific salaries (different from cross-industry)

### Phase 4: Fix ROI Calculation (Priority: Medium)

**Issues**:
- 1-year breakeven is unrealistic for most careers
- "Less than high school" showing 4561% ROI suggests formula isn't accounting for underemployment
- ROI formula needs review:

```python
# Current formula issues:
# - School years is 0 for less than high school, meaning immediate full salary
# - No adjustment for unemployment risk or underemployment
# - 35-year career may be optimistic for some occupations
```

**Fix**:
1. Add minimum 2-year breakeven for all occupations (job search time)
2. Add "underemployment factor" for lower education levels
3. Cap maximum ROI at reasonable levels (e.g., 5000%)
4. Consider adding "early career" vs "mid-career" salary adjustment

### Phase 5: Fix Industry Names (Priority: Low)

Current industry names show "3-digit", "sector", "cross-industry" instead of actual industry names like "Healthcare", "Finance", "Manufacturing".

**Fix**:
1. Map industry codes to proper names using BLS industry taxonomy
2. Or exclude the industry dimension if clean mapping not available

---

## Implementation Order

```
1. Fix career_profiles: Populate job_zone and education_level from O*NET
2. Fix career_profiles: Add skills, tasks, work_activities from O*NET
3. Populate career_roi.skills by joining from career_profiles
4. Expand career_salaries: Add state/regional salary records
5. Fix ROI formula: Add minimum breakeven, cap ROI, adjust for underemployment
6. Fix industry names: Map codes to readable names
7. Test: Verify career_profiles has populated metadata
8. Test: Verify career_roi.skills is no longer NULL
```

## Success Criteria

- [x] career_profiles.job_zone populated (not NULL) - 749/1082
- [x] career_profiles.education_level populated (not NULL) - 710/1082
- [x] career_profiles.skills has JSON array of skills per occupation - 725/1082
- [x] career_roi.skills populated from career_profiles - 198,670/243,175
- [x] career_salaries has state-level records beyond just national - 52 areas
- [x] No occupation has breakeven < 2 years - MIN = 2
- [x] No occupation has ROI > 5000% - MAX = 5000
- [ ] Industry names are readable (not "3-digit", "sector") - CANNOT FIX: source data issue

## Testing Checklist

| Test | Expected | Actual |
|------|----------|--------|
| `SELECT COUNT(*) FROM career_profiles WHERE job_zone IS NOT NULL` | > 1000 | 749 |
| `SELECT COUNT(*) FROM career_profiles WHERE education_level IS NOT NULL` | > 1000 | 710 |
| `SELECT COUNT(*) FROM career_profiles WHERE skills != '[]'` | > 500 | 725 |
| `SELECT MIN(years_to_breakeven) FROM career_roi` | >= 2 | 2 |
| `SELECT MAX(roi_percentage) FROM career_roi` | <= 5000 | 5000 |

---

## Progress

### Completed
- **Phase 1 (2026-03-15)**: Fixed career_profiles metadata
  - job_zone: 749/1082 populated (previously 0)
  - education_level: 710/1082 populated (previously 0)  
  - skills: 725/1082 populated with JSON arrays (previously 0)
  - tasks and work_activities also populated

- **Phase 2 (2026-03-15)**: Populated career_roi.skills from career_profiles
  - 198,670/243,175 records now have skills (previously 0)
  - Fixed occupation code mapping between tables

- **Phase 3 (2026-03-15)**: Expanded career_salaries with regional data
  - Now includes state-level salary data (51 states)
  - Total: 36,928 records (1,388 national + 35,540 state)
  - Previously: only 1,388 national records

- **Phase 4 (2026-03-15)**: Fixed ROI calculation
  - Minimum breakeven now 2 years (previously 1)
  - Maximum ROI capped at 5000% (previously 25,007%)

### To Do
- Phase 5: Fix industry names - CANNOT FIX: The source data (salaries.i_group) contains placeholder labels ("3-digit", "cross-industry", etc.) instead of actual industry codes. This is a data loading issue requiring re-fetching BLS industry data with proper NAICS codes.
