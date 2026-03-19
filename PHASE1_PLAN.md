# Phase 1 MVP - Implementation Plan

## Scope
- Swipe interface for career cards (stack-based)
- ROI data display (existing)
- Basic filtering (location, salary range)
- Post-swipe feedback collection

## Files to Create/Modify

### Frontend
| File | Action |
|------|--------|
| src/components/SwipeCard.tsx | Create |
| src/components/SwipeControls.tsx | Create |
| src/components/FilterSheet.tsx | Create |
| src/components/FilterChip.tsx | Create |
| src/components/FeedbackModal.tsx | Create |
| src/screens/SwipeScreen.tsx | Create |
| src/hooks/useSwipe.ts | Create |
| src/hooks/useFilters.ts | Create |
| src/hooks/useLocalStorage.ts | Create |
| src/types/index.ts | Modify |
| src/constants/dataSources.ts | Modify |
| App.tsx | Modify |

### Backend
| File | Action |
|------|--------|
| db/migrate/xxx_create_swipes.rb | Create |
| app/models/swipe.rb | Create |
| app/controllers/api/swipes_controller.rb | Create |
| app/controllers/api/roi_controller.rb | Modify |
| config/routes.rb | Modify |

## Implementation Order
1. Database migration (swipes table)
2. Backend: swipe controller + ROI filter params
3. Local storage hook
4. Filter components
5. Swipe components + feedback modal
6. Swipe screen integration
7. Navigation update

## Questions (pending answers)
1. Card animation: depth stack or single card?
2. API: batch fetch (20) or one-by-one?
3. Feedback timing: immediate or after details?
