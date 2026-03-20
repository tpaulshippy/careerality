# Plan: Combine Swipe + Explore into Unified Primary Interface

## Problem

The app currently has two separate screens doing overlapping things:

| Screen | File | Purpose |
|--------|------|---------|
| **Explore** (`HomeScreen`) | `client/src/screens/HomeScreen.tsx` | Shows a random top-50 career detail card with full ROI breakdown. "Find Another Career" loads another random one. No filtering. |
| **Swipe** | `client/src/screens/SwipeScreen.tsx` | Swipeable card stack with location/salary filtering, feedback modal, undo, and swipe recording. No detailed career view. |

Both fetch career data independently. Users must navigate between them via the drawer, fragmenting the experience.

## Goal

**One unified screen** that is the primary (and default) interface. Users can:
1. Browse careers via swipeable cards
2. Tap a card (or an "expand" action) to see the full detail view (ROI, skills, market demand)
3. Filter by location and salary range from a persistent filter bar
4. Record interest via post-swipe feedback
5. Undo swipes

---

## Current State of Filtering

Filtering infrastructure is **fully built** but underutilized:

- `useFilters` hook (`client/src/hooks/useFilters.ts:24`) — persists to local storage
- `FilterSheet` component (`client/src/components/FilterSheet.tsx:36`) — bottom sheet with free-text location/salary inputs
- `FilterChip` component (`client/src/components/FilterChip.tsx:12`) — created but **not rendered anywhere**
- Predefined options in `client/src/constants/dataSources.ts:37-53` — `LOCATION_OPTIONS` (7 regions) and `SALARY_RANGES` (6 tiers) — **defined but unused** by `FilterSheet`
- Backend `roi_controller.rb:5-21` — already supports `area`, `location`, `salary_min`, `salary_max` params

**Gap:** `FilterSheet` uses free-text inputs instead of the predefined chip/options. `FilterChip` exists but isn't wired up.

---

## Implementation Plan

### Step 1: Upgrade FilterChip + FilterSheet to use predefined options

**Files:**
- `client/src/components/FilterChip.tsx` — no changes needed, component is solid
- `client/src/components/FilterSheet.tsx` — rework to use `FilterChip` with `LOCATION_OPTIONS` and `SALARY_RANGES` from `dataSources.ts`

**Changes to `FilterSheet.tsx`:**
- Import `FilterChip`, `LOCATION_OPTIONS`, `SALARY_RANGES`
- Replace the free-text location `TextInput` with a horizontal scrollable row of `FilterChip` items from `LOCATION_OPTIONS`
- Replace the min/max salary `TextInput` pair with a horizontal scrollable row of `FilterChip` items from `SALARY_RANGES`
- Update `FilterState` to use selected option values instead of raw strings (e.g., `location: 'northeast'` instead of typed text)
- Show currently active filters as selected chips
- "Apply" triggers refetch, "Reset" clears all

### Step 2: Add an expandable detail view to SwipeCard

**Files:**
- `client/src/components/SwipeCard.tsx` — add a "View Details" tap target / expand button
- Create `client/src/components/CareerDetailView.tsx` — extracted from `HomeScreen.tsx`, receives a `CareerROI` prop

**Changes to `SwipeCard.tsx`:**
- Add an `onViewDetails` callback prop
- Add a "Details" button or make the card tappable (distinguish tap from swipe via gesture config — require a minimum velocity/distance for swipe, treat short taps as detail open)
- Import and render `CareerDetailView` in an expandable section or navigate to a detail overlay

**New `CareerDetailView.tsx`:**
- Extract the ScrollView content from `HomeScreen.tsx` (lines 20-79) into a reusable component
- Props: `career: CareerROI`, `onClose?: () => void`
- Contains: Salary, Investment & ROI, Location, Education & Skills, Market Demand sections
- Used both in the expanded card overlay and (optionally) as a standalone detail view

### Step 3: Create the unified screen — `DiscoverScreen.tsx`

**File:** `client/src/screens/DiscoverScreen.tsx` (new)

**Composition — merge from both screens:**

| Element | Source | What it brings |
|---------|--------|----------------|
| Filter bar with chip toggle | `FilterSheet` + `FilterChip` | Location + salary filtering, persistent |
| Swipeable card stack | `SwipeScreen` logic + `SwipeCard` | Gesture-based browsing, card animation |
| Swipe controls | `SwipeControls` | Skip/Like/Undo buttons |
| Detail overlay | New `CareerDetailView` | Full ROI breakdown on tap |
| Feedback modal | `FeedbackModal` | Post-swipe interest survey |
| Progress indicator | `SwipeScreen` header | "X of Y reviewed" |

**Behavior:**
1. Screen loads filtered careers (from `useFilters` + `apiClient.getCareers`)
2. Filter bar at top shows active filters as chips; tapping opens `FilterSheet`
3. Main area shows the current `SwipeCard`
4. Swipe left/right records the swipe and shows `FeedbackModal`
5. Tapping the card (not swiping) opens a full-screen detail overlay with `CareerDetailView`
6. Detail overlay has a back/close button to return to the card stack
7. `SwipeControls` at bottom for skip/like/undo
8. When all cards are swiped, show "All done" state with option to reset filters

### Step 4: Update navigation — make DiscoverScreen the default

**File:** `client/App.tsx`

**Changes:**
- Replace `HomeScreen` (Explore) and `SwipeScreen` with single `DiscoverScreen` route
- Default route: `name="Discover"` with title "Discover"
- Drawer icon: use a discover/explore icon
- Keep `DataSourcesScreen` in the drawer
- Remove `HomeScreen` and `SwipeScreen` from drawer

**Updated drawer:**

| Route | Title | Screen |
|-------|-------|--------|
| `Discover` | Discover | `DiscoverScreen` |
| `DataSources` | Data Sources | `DataSourcesScreen` |

### Step 5: Update barrel exports and clean up

**Files:**
- `client/src/screens/index.ts` — export `DiscoverScreen`, remove `HomeScreen` and `SwipeScreen`
- `client/src/components/index.ts` — export `CareerDetailView`
- Keep `HomeScreen.tsx` and `SwipeScreen.tsx` in repo for reference but remove from navigation

### Step 6: Update tests

**Files:**
- `client/src/screens/__tests__/SwipeScreen.test.tsx` — adapt or replace with `DiscoverScreen.test.tsx`
- Verify existing component tests still pass (FilterSheet, FilterChip, SwipeCard, etc.)

---

## File Change Summary

| File | Action | Description |
|------|--------|-------------|
| `client/src/components/FilterSheet.tsx` | **Modify** | Replace free-text inputs with FilterChip rows using predefined options |
| `client/src/components/SwipeCard.tsx` | **Modify** | Add `onViewDetails` prop + tap-to-expand gesture |
| `client/src/components/CareerDetailView.tsx` | **Create** | Extracted detail view from HomeScreen, accepts `CareerROI` prop |
| `client/src/screens/DiscoverScreen.tsx` | **Create** | Unified screen combining swipe + explore + filters |
| `client/App.tsx` | **Modify** | Replace 2 drawer routes with 1 Discover route |
| `client/src/screens/index.ts` | **Modify** | Update exports |
| `client/src/components/index.ts` | **Modify** | Add CareerDetailView export |
| `client/src/screens/__tests__/DiscoverScreen.test.tsx` | **Create** | Tests for unified screen |
| `client/src/screens/SwipeScreen.tsx` | **Keep** | No longer in navigation, kept for reference |
| `client/src/screens/HomeScreen.tsx` | **Keep** | No longer in navigation, kept for reference |

---

## Implementation Order

1. **FilterSheet upgrade** — wire up FilterChip + predefined options (standalone, no dependencies)
2. **CareerDetailView extraction** — pull detail view out of HomeScreen (standalone)
3. **SwipeCard tap-to-expand** — add detail view integration (depends on step 2)
4. **DiscoverScreen creation** — compose everything (depends on steps 1-3)
5. **Navigation update** — swap routes in App.tsx (depends on step 4)
6. **Exports + tests** — barrel exports, test coverage (depends on step 5)

Steps 1 and 2 can be done **in parallel**. Steps 3-6 are sequential.

---

## UX Flow

```
┌─────────────────────────────────┐
│  [Filter Chips: NE] [$50k+] [+] │  ← Filter bar (always visible)
├─────────────────────────────────┤
│                                 │
│  ┌───────────────────────────┐  │
│  │  Software Developer       │  │
│  │  New York, NY             │  │
│  │                           │  │
│  │       150% ROI            │  │
│  │                           │  │
│  │  Salary    $120,000       │  │
│  │  Edu Cost  $80,000        │  │
│  │  Break-even 2 years       │  │
│  │  Job Zone  4              │  │
│  │                           │  │
│  │  [ Tap to view details ]  │  │  ← Tap opens full detail overlay
│  └───────────────────────────┘  │
│                                 │
│       [✕ Undo ✓]                │  ← Swipe controls
│                                 │
│       3 of 47 reviewed          │  ← Progress
└─────────────────────────────────┘

Tap card →
┌─────────────────────────────────┐
│  ← Back                         │
│                                 │
│  Software Developer             │
│  SOC: 15-1252                   │
│                                 │
│  Salary Information             │
│  Median Salary      $120,000   │
│  Adjusted Salary    $115,000   │
│                                 │
│  Investment & ROI               │
│  Education Cost     $80,000    │
│  Years to Breakeven 2 years    │
│  ROI                150%       │
│                                 │
│  Location                       │
│  Area               New York   │
│  Cost of Living     1.25       │
│                                 │
│  Education & Skills             │
│  Education Level    Bachelor's │
│  Job Zone           4          │
│  Skills  [Java] [Python] [...]  │
│                                 │
│  Market Demand                  │
│  Demand Rank        #12        │
│  Annual Openings    35,000     │
│  Projected Growth   15%        │
│                                 │
│  [Swipe to continue browsing]   │
└─────────────────────────────────┘
```

---

## Open Questions

1. **Card tap vs. swipe conflict:** Need to differentiate a tap from a swipe in `SwipeCard`. Options:
   - Use `Gesture.Tap()` combined with `Gesture.Pan()` via `Gesture.Race()` — tap opens details, pan swipes
   - Add a dedicated "Details" button overlay on the card (simpler, less discoverable)
   - **Recommendation:** Use `Gesture.Race()` with a tap gesture. Tap if movement < 10px, swipe if > 100px threshold.

2. **Detail overlay presentation:** Full-screen modal, bottom sheet, or inline expand?
   - **Recommendation:** Full-screen slide-in overlay with back button. Keeps swipe stack state intact.

3. **Filter bar visibility:** Always visible or collapsible?
   - **Recommendation:** Always visible as a compact chip row. Takes minimal space, shows active state.

4. **HomeScreen "Find Another Career" feature:** This random-explore mode is redundant once swipe is the primary interface. The swipe deck already serves this purpose with more structure.
