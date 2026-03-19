# Phase 1 MVP - Implementation Plan

## Scope
- Swipe interface for career cards (stack-based)
- ROI data display (existing)
- Basic filtering (location, salary range)
- Post-swipe feedback collection

## Files to Create/Modify

### Backend (Group 1)
| File | Action | Status |
|------|--------|--------|
| db/migrate/xxx_create_swipes.rb | Create | ⬜ |
| app/models/swipe.rb | Create | ⬜ |
| app/controllers/api/swipes_controller.rb | Create | ⬜ |
| app/controllers/api/roi_controller.rb | Modify | ⬜ |
| config/routes.rb | Modify | ⬜ |

### Frontend Hooks (Group 2)
| File | Action | Status |
|------|--------|--------|
| src/hooks/useLocalStorage.ts | Create | ⬜ |
| src/hooks/useFilters.ts | Create | ⬜ |
| src/hooks/useSwipe.ts | Create | ⬜ |

### Frontend Components (Groups 3 & 4)
| File | Action | Status |
|------|--------|--------|
| src/components/FilterChip.tsx | Create | ⬜ |
| src/components/FilterSheet.tsx | Create | ⬜ |
| src/components/SwipeCard.tsx | Create | ⬜ |
| src/components/SwipeControls.tsx | Create | ⬜ |
| src/components/FeedbackModal.tsx | Create | ⬜ |

### Frontend Integration (Group 5)
| File | Action | Status |
|------|--------|--------|
| src/screens/SwipeScreen.tsx | Create | ⬜ |
| App.tsx | Modify | ⬜ |

### Types/Constants (Group 6)
| File | Action | Status |
|------|--------|--------|
| src/types/index.ts | Modify | ⬜ |
| src/constants/dataSources.ts | Modify | ⬜ |

## Parallel Task Groups

| Group | Tasks |
|-------|-------|
| **1. Backend** | Migration, swipe.rb model, swipes_controller, roi_controller filters, routes |
| **2. Frontend Hooks** | useLocalStorage, useFilters, useSwipe |
| **3. Filter Components** | FilterChip, FilterSheet |
| **4. Swipe Components** | SwipeCard, SwipeControls, FeedbackModal |
| **5. Integration** | SwipeScreen, App.tsx navigation |
| **6. Types/Constants** | types/index.ts, constants/dataSources.ts |

## Implementation Order

### Phase 1 - Backend (run first, sequential)
1. Database migration (swipes table)
2. Backend: swipe controller + ROI filter params

### Phase 2 - Frontend Hooks (parallel with backend)
3. Local storage hook
4. Filter hook
5. Swipe hook

### Phase 3 - Components (depend on hooks)
6. Filter components
7. Swipe components + feedback modal

### Phase 4 - Integration (depend on all)
8. Swipe screen integration
9. Navigation update

## Questions (pending answers)
1. Card animation: depth stack or single card?
2. API: batch fetch (20) or one-by-one?
3. Feedback timing: immediate or after details?
