import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { CareerROI } from '../types';
import { apiClient } from '../api/client';
import { rankCareers } from '../api/jevRank';
import { useSwipe } from '../hooks/useSwipe';
import { useFilters } from '../hooks/useFilters';
import { SwipeCard, SwipeControls, CareerDetailView } from '../components';
import { FilterSheet, FilterState } from '../components/FilterSheet';
import { SortOption } from '../types';
import { FeedbackModal, InterestLevel } from '../components/FeedbackModal';
import { useTheme } from '../hooks/useTheme';
import { useGamification } from '../hooks/useGamification';
import { XpPill } from '../components/XpPill';
import { LevelUpOverlay } from '../components/LevelUpOverlay';

const SORT_LABELS: Record<SortOption, string> = {
  roi: 'ROI',
  salary: 'Salary',
  breakeven: 'Break-even',
  demand: 'Demand',
};

interface DiscoverScreenProps {
  // Search lives behind the experimental-screens flag; hidden unless enabled.
  searchEnabled?: boolean;
}

export const DiscoverScreen: React.FC<DiscoverScreenProps> = ({ searchEnabled }) => {
  const theme = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ Discover: { stateCode?: string } | undefined }, 'Discover'>>();
  const [careers, setCareers] = useState<CareerROI[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [dataKey, setDataKey] = useState(0);
  const [cardReset] = useState(0);
  const [detailCareer, setDetailCareer] = useState<CareerROI | null>(null);
  const [feedbackCareer, setFeedbackCareer] = useState<CareerROI | null>(null);
  const [celebrateLevel, setCelebrateLevel] = useState<number | null>(null);
  const heldLevelRef = useRef<number | null>(null);
  const fetchKeyRef = useRef(0);
  const currentPageRef = useRef(1);
  const hasMoreRef = useRef(true);
  const careersLengthRef = useRef(0);
  const currentIndexRef = useRef(0);
  const loadingMoreRef = useRef(false);
  // Rerank state: server history at load + optimistic session swipes (with
  // feedback), so every swipe can reorder the remaining stack in one call.
  const careersRef = useRef<CareerROI[]>([]);
  const historyRef = useRef<unknown[]>([]);
  const sessionSwipesRef = useRef<Array<{ career_id: number; direction: 'left' | 'right'; feedback?: string }>>([]);
  const rankSeqRef = useRef(0);

  const { filters, setStateCode, setSalaryMin, setSalaryMax, setSortBy } = useFilters();
  const gamification = useGamification();
  const { cards, swipeLeft, swipeRight, undo, currentIndex, resetSwipes } = useSwipe(careers);

  useEffect(() => {
    careersLengthRef.current = careers.length;
    careersRef.current = careers;
  }, [careers]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    loadingMoreRef.current = loadingMore;
  }, [loadingMore]);

  const fetchCareers = useCallback(async (page: number = 1, append: boolean = false) => {
    const thisFetch = ++fetchKeyRef.current;
    
    if (!append) {
      currentPageRef.current = 1;
      hasMoreRef.current = true;
      setLoading(true);
      setError(null);
    } else {
      setLoadingMore(true);
    }

    try {
      const params: Record<string, string | number> = { page };
      if (filters.stateCode) params.area_code = filters.stateCode;
      if (filters.salaryMin > 0) params.min_salary = filters.salaryMin;
      if (filters.salaryMax < 1000000) params.max_salary = filters.salaryMax;
      if (filters.sortBy) params.sort = filters.sortBy;

      const json = await apiClient.getCareers(params) as { records: CareerROI[]; pagy?: { pages: number } };

      if (thisFetch !== fetchKeyRef.current) return;

      const data: CareerROI[] = Array.isArray(json) ? json : (json.records || []);
      const totalPages = json.pagy?.pages ?? 1;

      hasMoreRef.current = page < totalPages;
      currentPageRef.current = page;

      if (append) {
        setCareers(prev => [...prev, ...data]);
      } else {
        // Jev re-rank: swipe history + candidate codes/names go to
        // POST /api/jev/rank (one listwise call); any failure keeps order.
        let ordered = data;
        try {
          const history = await apiClient.getSwipeHistory().catch(() => ({ swipes: [] as never[] }));
          const swipes = (history as { swipes?: unknown[] }).swipes ?? [];
          historyRef.current = swipes;
          sessionSwipesRef.current = [];
          rankSeqRef.current++;
          const ranked = await rankCareers(swipes, data.map(c => ({ occupation_code: c.occupation_code, occupation_name: c.occupation_name })));
          if (thisFetch !== fetchKeyRef.current) return;
          if (ranked && ranked.results.length > 0 && ranked.results.every(r => r.provider === 'jev')) {
            const position = new Map(ranked.results.map((r, i) => [r.occupation_code, i]));
            ordered = [...data].sort(
              (a, b) => (position.get(a.occupation_code) ?? 999) - (position.get(b.occupation_code) ?? 999)
            );
          }
        } catch {
          // Keep server order when ranking is unavailable.
        }
        if (thisFetch !== fetchKeyRef.current) return;
        setCareers(ordered);
        setDataKey(prev => prev + 1);
        resetSwipes();
      }
    } catch {
      if (thisFetch === fetchKeyRef.current) {
        setError('Failed to load careers');
      }
    } finally {
      if (thisFetch === fetchKeyRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [filters.stateCode, filters.salaryMin, filters.salaryMax, filters.sortBy, resetSwipes]);

  useEffect(() => {
    fetchCareers();
  }, [fetchCareers]);

  // Apply a state filter handed over from the Map screen (Discover is often
  // already mounted, so persisted-storage updates alone wouldn't refetch).
  const appliedRouteStateRef = useRef<string | null>(null);
  useEffect(() => {
    const routeStateCode = route.params?.stateCode;
    if (routeStateCode && routeStateCode !== appliedRouteStateRef.current) {
      appliedRouteStateRef.current = routeStateCode;
      setStateCode(routeStateCode);
    }
  }, [route.params?.stateCode, setStateCode]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (careers.length === 0 && !loading && !error) {
        fetchCareers();
      }
    });
    return unsubscribe;
  }, [navigation, careers.length, loading, error, fetchCareers]);

  // Reorder only the unswiped tail after each swipe: one listwise Jev call
  // over (server history + session swipes) x remaining candidates. The head
  // (already swiped) is untouched so the swipe index stays valid. Stale
  // responses (newer swipe or appended page landed first) are dropped.
  const rerankRemaining = useCallback(async () => {
    const mySeq = ++rankSeqRef.current;
    const idx = currentIndexRef.current;
    const remaining = careersRef.current.slice(idx);
    if (remaining.length <= 1) return;
    try {
      const swipes = [...historyRef.current, ...sessionSwipesRef.current];
      const ranked = await rankCareers(swipes, remaining.map(c => ({ occupation_code: c.occupation_code, occupation_name: c.occupation_name })));
      if (mySeq !== rankSeqRef.current || currentIndexRef.current !== idx) return;
      if (!ranked || ranked.results.length === 0 || !ranked.results.every(r => r.provider === 'jev')) return;
      const position = new Map(ranked.results.map((r, i) => [r.occupation_code, i]));
      setCareers(prev => {
        if (prev.length < idx || prev.length - idx !== remaining.length) return prev;
        const head = prev.slice(0, idx);
        const tail = [...prev.slice(idx)].sort(
          (a, b) => (position.get(a.occupation_code) ?? 999) - (position.get(b.occupation_code) ?? 999)
        );
        return [...head, ...tail];
      });
    } catch {
      // Keep current order when ranking is unavailable.
    }
  }, []);

  const handleSwipeLeft = useCallback(() => {
    const career = swipeLeft();
    if (career) {
      submitSwipe(career.id, 'left');
      sessionSwipesRef.current = [...sessionSwipesRef.current, { career_id: career.id, direction: 'left' as const }];
      void rerankRemaining();
      const result = gamification.trackEvent({ type: 'swipe_left', career });
      if (result?.leveledUp) setCelebrateLevel(result.newLevel);
    }
    checkAndLoadMore();
  }, [swipeLeft, gamification, rerankRemaining]);

  const handleSwipeRight = useCallback(() => {
    const career = swipeRight();
    if (career) {
      // Hold the POST until the feedback modal resolves; card advances immediately.
      setFeedbackCareer(career);
      const result = gamification.trackEvent({ type: 'swipe_right', career });
      // Hold the celebration until the feedback modal closes so it isn't buried.
      if (result?.leveledUp) heldLevelRef.current = result.newLevel;
    }
    checkAndLoadMore();
  }, [swipeRight, gamification]);

  const checkAndLoadMore = useCallback(() => {
    if (!loadingMoreRef.current && hasMoreRef.current && currentIndexRef.current >= careersLengthRef.current - 5) {
      fetchCareers(currentPageRef.current + 1, true);
    }
  }, [fetchCareers]);

  const submitSwipe = async (careerId: number, direction: 'left' | 'right', feedback?: string) => {
    try {
      await apiClient.submitSwipe(careerId, direction, feedback);
    } catch {
      // Swipe submission failed silently - user can retry
    }
  };

  const handleFeedbackSubmit = useCallback((interest: InterestLevel) => {
    const career = feedbackCareer;
    setFeedbackCareer(null);
    if (career) {
      submitSwipe(career.id, 'right', interest);
      sessionSwipesRef.current = [...sessionSwipesRef.current, { career_id: career.id, direction: 'right' as const, feedback: interest }];
      void rerankRemaining();
      const result = gamification.trackEvent({ type: 'feedback' });
      if (result?.leveledUp) {
        setCelebrateLevel(result.newLevel);
      } else if (heldLevelRef.current !== null) {
        setCelebrateLevel(heldLevelRef.current);
      }
    }
    heldLevelRef.current = null;
  }, [feedbackCareer, gamification, rerankRemaining]);

  const handleFeedbackClose = useCallback(() => {
    const career = feedbackCareer;
    setFeedbackCareer(null);
    if (career) {
      submitSwipe(career.id, 'right');
      sessionSwipesRef.current = [...sessionSwipesRef.current, { career_id: career.id, direction: 'right' as const }];
      void rerankRemaining();
    }
    if (heldLevelRef.current !== null) {
      setCelebrateLevel(heldLevelRef.current);
      heldLevelRef.current = null;
    }
  }, [feedbackCareer, rerankRemaining]);

  const handleFilterApply = useCallback((filterState: FilterState) => {
    setStateCode(filterState.stateCode);
    setSalaryMin(filterState.minSalary);
    setSalaryMax(filterState.maxSalary);
    setSortBy(filterState.sortBy);
  }, [setStateCode, setSalaryMin, setSalaryMax, setSortBy]);

  const handleUndo = useCallback(() => {
    const undone = undo();
    if (undone && sessionSwipesRef.current.length > 0) {
      sessionSwipesRef.current = sessionSwipesRef.current.slice(0, -1);
      void rerankRemaining();
    }
  }, [undo, rerankRemaining]);

  const handleViewDetails = useCallback((career: CareerROI) => {
    setDetailCareer(career);
    const result = gamification.trackEvent({ type: 'detail_view', career });
    if (result?.leveledUp) setCelebrateLevel(result.newLevel);
  }, [gamification]);

  const handleCloseDetails = useCallback(() => {
    setDetailCareer(null);
  }, []);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.text.secondary }]}>
          Loading careers to explore...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
        <Text style={[styles.retryText, { color: theme.colors.primary }]} onPress={() => fetchCareers()}>
          Tap to retry
        </Text>
      </View>
    );
  }

  if (detailCareer) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <CareerDetailView career={detailCareer} onClose={handleCloseDetails} />
      </View>
    );
  }

  const currentCard = cards[currentIndex];
  const hasCareers = careers.length > 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]} key={dataKey}>
      <View style={styles.headerBar}>
        {hasCareers && (
          <Text style={[styles.progress, { color: theme.colors.text.secondary }]}>
            {currentIndex} of {cards.length} reviewed
          </Text>
        )}
        <View style={styles.headerActions}>
          {searchEnabled && (
            <TouchableOpacity onPress={() => navigation.navigate('Search')} aria-label="Search careers">
              <Text style={styles.searchShortcut}>🔍</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => setFilterSheetVisible(true)}>
            <Text style={{ color: theme.colors.primary }}>
              {filters.sortBy !== 'roi' ? `Filter · ${SORT_LABELS[filters.sortBy]}` : 'Filter'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.cardContainer}>
        {!hasCareers ? (
          <View style={[styles.emptyState, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.emptyTitle, { color: theme.colors.text.primary }]}>
              No careers found
            </Text>
            <Text style={[styles.emptySubtitle, { color: theme.colors.text.secondary }]}>
              Try again later
            </Text>
          </View>
        ) : currentCard ? (
          <SwipeCard
            career={currentCard}
            onSwipeLeft={handleSwipeLeft}
            onSwipeRight={handleSwipeRight}
            onViewDetails={() => handleViewDetails(currentCard)}
            cardKey={currentIndex}
            shouldReset={cardReset}
          />
        ) : (
          <View style={[styles.emptyState, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.emptyTitle, { color: theme.colors.text.primary }]}>
              All done!
            </Text>
            <Text style={[styles.emptySubtitle, { color: theme.colors.text.secondary }]}>
              You've reviewed all available careers
            </Text>
            {hasMoreRef.current && (
              <TouchableOpacity onPress={() => fetchCareers(currentPageRef.current + 1, true)}>
                <Text style={{ color: theme.colors.primary, marginTop: 12 }}>
                  {loadingMore ? 'Loading more...' : 'Tap to load more'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      <SwipeControls
        onSkip={handleSwipeLeft}
        onLike={handleSwipeRight}
        onUndo={currentIndex > 0 ? handleUndo : undefined}
        disabled={!currentCard}
      />

      <FilterSheet
        visible={filterSheetVisible}
        onClose={() => setFilterSheetVisible(false)}
        onApply={handleFilterApply}
        initialFilters={{
          stateCode: filters.stateCode,
          minSalary: filters.salaryMin,
          maxSalary: filters.salaryMax,
          sortBy: filters.sortBy,
        }}
      />

      <XpPill gain={gamification.xpPill} onDismiss={gamification.dismissXpPill} />
      <LevelUpOverlay level={celebrateLevel} onDismiss={() => setCelebrateLevel(null)} />

      <FeedbackModal
        visible={feedbackCareer !== null}
        careerName={feedbackCareer?.occupation_name ?? ''}
        onSubmit={handleFeedbackSubmit}
        onClose={handleFeedbackClose}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  } as ViewStyle,
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  } as ViewStyle,
  loadingText: {
    marginTop: 16,
    fontSize: 15,
  } as TextStyle,
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  } as ViewStyle,
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 12,
  } as TextStyle,
  retryText: {
    fontSize: 16,
    fontWeight: '600',
  } as TextStyle,
  progress: {
    fontSize: 13,
    marginTop: 4,
  } as TextStyle,
  cardContainer: {
    flex: 1,
    justifyContent: 'center',
  } as ViewStyle,
  emptyState: {
    margin: 20,
    padding: 40,
    borderRadius: 16,
    alignItems: 'center',
  } as ViewStyle,
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  } as TextStyle,
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  } as TextStyle,
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  } as ViewStyle,
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  } as ViewStyle,
  searchShortcut: {
    fontSize: 18,
  } as TextStyle,
});
