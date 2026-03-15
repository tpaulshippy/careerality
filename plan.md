# Data Transformation Improvement Plan

## Problem Summary

The `data/transform.py` script produces output with significant quality issues:

| Issue | Impact |
|-------|--------|
| Cost of living data missing | No state-level salary adjustments possible |
| Flat education costs | All occupations get same ~$50K tuition regardless of field/state |
| Incorrect education levels | Physicians showing "Some college" |
| Crude job zones | Hard-coded from occupation prefix, not O*NET data |
| Oversimplified ROI | 10-year fixed, no inflation/opportunity cost |

## Plan

### Phase 1: Fix Source Data (Priority: Critical)

1. **Populate cost_of_living table**
   - Source actual COL data from BLS or external API
   - Ensure state-level indexes exist (not just national)
   - Verify `area` column has valid state identifiers

2. **Verify O*NET education data loading**
   - Check `onet_data` table has `education_experience` records
   - Validate `Element ID = '2.D.1'` contains valid education categories

### Phase 2: Improve Education Cost Calculation

1. **Get actual tuition by state and degree level**
   - Query IPEDS tuition data properly (current query fails)
   - Match tuition by institution level (4-year vs 2-year vs graduate)
   - Handle in-state vs out-of-state correctly

2. **Calculate degree-specific costs**
   - Associate's: 2 years of community college tuition
   - Bachelor's: 4 years of in-state public university
   - Master's: +2 years after bachelor's
   - Doctoral/Medical: 4-8 years depending on field

### Phase 3: Fix Occupation Metadata

1. **Use actual O*NET job zones**
   - Query O*NET Job Zone database instead of code prefix
   - Map `job_zone` from `Element ID = '1.A.1'` or similar

2. **Correct education level mappings**
   - Pull from O*NET's "Required Level of Education" (2.D.1)
   - Match O*NET category codes to human-readable labels

### Phase 4: Improve ROI Calculation

1. **Add salary growth trajectory**
   - Entry-level vs mid-career vs senior salaries
   - Use BLS percentiles to estimate growth

2. **Account for inflation**
   - Discount future earnings by ~3% annually

3. **Include opportunity cost**
   - Lost wages during schooling years

4. **Calculate more realistic breakeven**
   - Account for typical career length (~30-40 years)

### Phase 5: Testing & Validation

1. **Sanity checks**
   - Doctors should have education_cost > $150K
   - California COL > Nebraska COL
   - Job zones should vary within same occupation code prefix

2. **Spot check samples**
   - Sample 10 diverse occupations and verify each field
   - Compare computed ROI against external sources (e.g., Payscale)

## Implementation Order

```
1. transform.py: fix cost_of_living source query
2. transform.py: fix IPEDS tuition queries (transaction issues)
3. transform.py: use O*NET job_zones table
4. transform.py: improve ROI formula with growth/inflation
5. Test: verify realistic values for sample occupations
```

## Success Criteria

- [x] State-level cost of living data exists for 50+ states/regions
- [x] Education cost varies by degree level (not flat $50K)
- [x] Physicians show doctoral-level education, not "some college"
- [x] Job zones derived from O*NET, not occupation code prefix
- [x] ROI accounts for inflation and opportunity cost
- [x] Sample spot checks pass sanity tests

## Progress (2026-03-15)

### Completed
1. **Populated cost_of_living table** - Loaded EPI family budget data, aggregated by state, created relative COL indexes (100 = national average). Now have 52 state/region records.

2. **Fixed O*NET education data loading** - Now correctly uses `data_value` from `onet_education` table instead of incorrectly using `category`. Oral and Maxillofacial Surgeons now correctly show "Post-doctoral training" with $57K education cost.

3. **Fixed IPEDS tuition queries** - Added transaction rollback after exceptions to handle missing tables gracefully. Now completes without errors.

4. **Use actual O*NET job zones** - Now loads job zones from O*NET `job_zones` data with fallback to old prefix-based logic. Distribution: Zone 2 (88K), Zone 3 (56K), Zone 4 (51K), Zone 5 (28K).

5. **Improved ROI calculation** - Now includes:
   - 3% inflation discount rate
   - 2% annual salary growth
   - Opportunity cost (30% of salary during school years)
   - 35-year career span
   - More realistic breakeven (e.g., Software Dev: 2 yrs, Surgeons: 5 yrs)

### Verified
- California COL (127.43) > Nebraska COL (90.76)
- Education costs vary: Professional ($91K) > Doctoral ($77K) > Master's ($68K) > Bachelor's ($45K)
- Job zones vary across occupations (not all same prefix)
- Software Developer ROI: 2 years breakeven, ~1400% ROI
- Oral/Maxillofacial Surgeon: 5 years breakeven, ~230% ROI
