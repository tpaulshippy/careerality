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

- [ ] State-level cost of living data exists for 50+ states/regions
- [ ] Education cost varies by degree level (not flat $50K)
- [ ] Physicians show doctoral-level education, not "some college"
- [ ] Job zones derived from O*NET, not occupation code prefix
- [ ] ROI accounts for inflation and opportunity cost
- [ ] Sample spot checks pass sanity tests
