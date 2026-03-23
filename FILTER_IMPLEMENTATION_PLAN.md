# Location and Salary Filter Implementation Plan

## Overview
Implement state-based location filtering and salary range slider for the career discovery application, with full backend support.

## Backend Changes

### 1. Update ROI Controller (`roi_controller.rb`)
**Location:** `server/app/controllers/api/roi_controller.rb:5-21`

**Changes:**
- Accept new parameters: `area_code`, `min_salary`, `max_salary`
- Maintain backward compatibility with existing `area`, `location`, `salary_min`, `salary_max`
- Handle single state code filtering (string or array for future expansion)

**Implementation:**
```ruby
# Determine area code from various parameter names
area = params[:area_code] || params[:area] || params[:location]
base_query = if area.present?
  CareerRoi.where(area_code: area)
else
  CareerRoi.all
end

# Salary filters (support both new and old param names)
if params[:min_salary].present?
  base_query = base_query.where("annual_median_salary >= ?", params[:min_salary].to_f)
end
if params[:salary_min].present?
  base_query = base_query.where("annual_median_salary >= ?", params[:salary_min].to_f)
end
if params[:max_salary].present?
  base_query = base_query.where("annual_median_salary <= ?", params[:max_salary].to_f)
end
if params[:salary_max].present?
  base_query = base_query.where("annual_median_salary <= ?", params[:salary_max].to_f)
end
```

### 2. Create Areas Endpoint
**New file:** `server/app/controllers/api/areas_controller.rb`
**Action:** `states` - returns list of state codes and names

**Logic:**
- Query `career_roi` table for distinct state-level entries
- Filter for area codes with length ≤ 2 and area names without commas
- Include "National" option (area_code "99")

**Route:** Add to `config/routes.rb`:
```ruby
namespace :api do
  resources :areas, only: [] do
    collection do
      get :states
    end
  end
end
```

## Frontend Changes

### 1. Install Dependencies
```bash
cd client
npm install @react-native-picker/picker react-native-range-slider
```

### 2. Update Filter State (`useFilters.ts`)
**Changes:**
- Rename `location` to `stateCode` (string)
- Default value: "99" (National)
- Keep `salaryMin` (0) and `salaryMax` (1,000,000)

**Updated interface:**
```typescript
export interface Filters {
  stateCode: string;  // FIPS code or "99" for National
  salaryMin: number;
  salaryMax: number;
}
```

### 3. Modify FilterSheet Component
**Location:** `client/src/components/FilterSheet.tsx`

**Changes:**
1. **State Dropdown:**
   - Replace `TextInput` for location with `Picker` from `@react-native-picker/picker`
   - Fetch states from `/api/areas/states` on component mount
   - Include "National" option (value: "99")

2. **Salary Range Slider:**
   - Replace min/max text inputs with `RangeSlider` component
   - Configure: min=0, max=1,000,000, step=1,000
   - Display current range values

3. **Update FilterState interface:**
   ```typescript
   export interface FilterState {
     stateCode: string;
     minSalary: number;
     maxSalary: number;
   }
   ```

### 4. Update SwipeScreen (`SwipeScreen.tsx`)
**Changes:**
- Update `handleFilterApply` to work with new `FilterState`
- Send `area_code` (single string) instead of `location`
- Send `min_salary`/`max_salary` as numbers

**Updated params:**
```typescript
if (filters.stateCode) params.area_code = filters.stateCode;
if (filters.salaryMin > 0) params.min_salary = filters.salaryMin;
if (filters.salaryMax < 1000000) params.max_salary = filters.salaryMax;
```

## Implementation Order

1. **Backend First:**
   - Update ROI controller
   - Create areas endpoint and controller
   - Test with curl/Postman

2. **Frontend Dependencies:**
   - Install UI libraries

3. **Frontend Updates:**
   - Update `useFilters` hook
   - Modify `FilterSheet` component
   - Update `SwipeScreen` to use new filters

4. **Testing:**
   - Verify backend filtering works
   - Test UI interactions
   - Ensure default National behavior

## Key Decisions
- **Single state selection:** Simpler UI and backend (multi-select can be added later)
- **Library for range slider:** Better UX than custom component
- **Default to National:** When no state selected, use area_code "99"
- **Backward compatibility:** Keep existing parameter support

## Data Notes
- State FIPS codes (1-56) stored as `area_code` in `career_roi`
- National data uses area_code "99"
- State names stored in `area_name` without commas (e.g., "Florida")

## Testing Checklist
- [ ] Backend accepts `area_code`, `min_salary`, `max_salary`
- [ ] Backend returns filtered results for selected state
- [ ] State dropdown populated with all states + National
- [ ] Salary range slider updates filters correctly
- [ ] Default filters show National data with full salary range
- [ ] Filter persistence works across sessions