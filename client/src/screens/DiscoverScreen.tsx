import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { CareerROI } from '../types';
import { apiClient } from '../api/client';
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

export const DiscoverScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation();
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

  const { filters, setStateCode, setSalaryMin, setSalaryMax, setSortBy } = useFilters();
  const gamification = useGamification();
  const { cards, swipeLeft, swipeRight, undo, currentIndex, resetSwipes } = useSwipe(careers);

  useEffect(() => {
    careersLengthRef.current = careers.length;
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
        setCareers(data);
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

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (careers.length === 0 && !loading && !error) {
        fetchCareers();
      }
    });
    return unsubscribe;
  }, [navigation, careers.length, loading, error, fetchCareers]);

  const handleSwipeLeft = useCallback(() => {
    const career = swipeLeft();
    if (career) {
      submitSwipe(career.id, 'left');
      const result = gamification.trackEvent({ type: 'swipe_left', career });
      if (result?.leveledUp) setCelebrateLevel(result.newLevel);
    }
    checkAndLoadMore();
  }, [swipeLeft, gamification]);

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
      const result = gamification.trackEvent({ type: 'feedback' });
      if (result?.leveledUp) {
        setCelebrateLevel(result.newLevel);
      } else if (heldLevelRef.current !== null) {
        setCelebrateLevel(heldLevelRef.current);
      }
    }
    heldLevelRef.current = null;
  }, [feedbackCareer, gamification]);

  const handleFeedbackClose = useCallback(() => {
    const career = feedbackCareer;
    setFeedbackCareer(null);
    if (career) {
      submitSwipe(career.id, 'right');
    }
    if (heldLevelRef.current !== null) {
      setCelebrateLevel(heldLevelRef.current);
      heldLevelRef.current = null;
    }
  }, [feedbackCareer]);

  const handleFilterApply = useCallback((filterState: FilterState) => {
    setStateCode(filterState.stateCode);
    setSalaryMin(filterState.minSalary);
    setSalaryMax(filterState.maxSalary);
    setSortBy(filterState.sortBy);
  }, [setStateCode, setSalaryMin, setSalaryMax, setSortBy]);

  const handleUndo = useCallback(() => {
    undo();
  }, [undo]);

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
        <TouchableOpacity onPress={() => setFilterSheetVisible(true)}>
          <Text style={{ color: theme.colors.primary }}>
            {filters.sortBy !== 'roi' ? `Filter · ${SORT_LABELS[filters.sortBy]}` : 'Filter'}
          </Text>
        </TouchableOpacity>
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
});
