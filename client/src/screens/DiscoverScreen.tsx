import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, ViewStyle, TextStyle, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { CareerROI } from '../types';
import { apiClient } from '../api/client';
import { useSwipe } from '../hooks/useSwipe';
import { useFilters } from '../hooks/useFilters';
import { FilterChip, SwipeCard, SwipeControls, FilterSheet, FeedbackModal, CareerDetailView } from '../components';
import { useTheme } from '../hooks/useTheme';
import { FilterState } from '../components/FilterSheet';
import { LOCATION_OPTIONS, SALARY_RANGES } from '../constants/dataSources';

export const DiscoverScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation();
  const [careers, setCareers] = useState<CareerROI[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [currentCareerName, setCurrentCareerName] = useState('');
  const [dataKey, setDataKey] = useState(0);
  const [cardReset, setCardReset] = useState(0);
  const [detailCareer, setDetailCareer] = useState<CareerROI | null>(null);
  const fetchKeyRef = useRef(0);

  const { filters, setLocation, setSalaryMin, setSalaryMax, resetFilters } = useFilters();
  const { cards, swipeLeft, swipeRight, undo, currentIndex, resetSwipes } = useSwipe(careers);

  const fetchCareers = useCallback(async () => {
    const thisFetch = ++fetchKeyRef.current;
    setLoading(true);
    setError(null);

    try {
      const params: Record<string, string | number> = {};
      if (filters.location) params.area_code = filters.location;
      if (filters.salaryMin > 0) params.min_salary = filters.salaryMin;
      if (filters.salaryMax < 1000000) params.max_salary = filters.salaryMax;

      const json = await apiClient.getCareers(params) as { records: CareerROI[] } | CareerROI[];

      if (thisFetch !== fetchKeyRef.current) return;

      const data: CareerROI[] = Array.isArray(json) ? json : (json.records || []);
      setCareers(data);
      setDataKey(prev => prev + 1);
      resetSwipes();
    } catch {
      if (thisFetch === fetchKeyRef.current) {
        setError('Failed to load careers');
      }
    } finally {
      if (thisFetch === fetchKeyRef.current) {
        setLoading(false);
      }
    }
  }, [filters.location, filters.salaryMin, filters.salaryMax, resetSwipes]);

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
      setCurrentCareerName(career.occupation_name);
      setFeedbackVisible(true);
      submitSwipe(career.id, 'left');
    }
  }, [swipeLeft]);

  const handleSwipeRight = useCallback(() => {
    const career = swipeRight();
    if (career) {
      setCurrentCareerName(career.occupation_name);
      setFeedbackVisible(true);
      submitSwipe(career.id, 'right');
    }
  }, [swipeRight]);

  const submitSwipe = async (careerId: number, direction: 'left' | 'right') => {
    try {
      await apiClient.submitSwipe(careerId, direction);
    } catch {
      // Swipe submission failed silently - user can retry
    }
  };

  const handleFeedbackSubmit = useCallback(() => {
    setFeedbackVisible(false);
    setCardReset(prev => prev + 1);
  }, []);

  const handleFilterApply = useCallback((filterState: FilterState) => {
    setLocation(filterState.location);
    setSalaryMin(filterState.minSalary ? parseInt(filterState.minSalary, 10) : 0);
    setSalaryMax(filterState.maxSalary ? parseInt(filterState.maxSalary, 10) : 1000000);
  }, [setLocation, setSalaryMin, setSalaryMax]);

  const handleUndo = useCallback(() => {
    undo();
  }, [undo]);

  const handleViewDetails = useCallback((career: CareerROI) => {
    setDetailCareer(career);
  }, []);

  const handleCloseDetails = useCallback(() => {
    setDetailCareer(null);
  }, []);

  const getLocationLabel = () => {
    if (!filters.location) return null;
    const option = LOCATION_OPTIONS.find(o => o.value === filters.location);
    return option ? option.label : filters.location;
  };

  const getSalaryLabel = () => {
    if (filters.salaryMin === 0 && filters.salaryMax >= 1000000) return null;
    const range = SALARY_RANGES.find(r => r.min === filters.salaryMin);
    return range ? range.label : null;
  };

  const hasActiveFilters = filters.location || filters.salaryMin > 0 || filters.salaryMax < 1000000;

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
        <Text style={[styles.retryText, { color: theme.colors.primary }]} onPress={fetchCareers}>
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

  const locationLabel = getLocationLabel();
  const salaryLabel = getSalaryLabel();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]} key={dataKey}>
      <View style={styles.filterBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterBarContent}
        >
          {locationLabel && (
            <FilterChip
              label={locationLabel}
              selected
              onPress={() => setFilterSheetVisible(true)}
              onRemove={() => {
                setLocation('');
                setFilterSheetVisible(false);
              }}
            />
          )}
          {salaryLabel && (
            <FilterChip
              label={salaryLabel}
              selected
              onPress={() => setFilterSheetVisible(true)}
              onRemove={() => {
                setSalaryMin(0);
                setSalaryMax(1000000);
                setFilterSheetVisible(false);
              }}
            />
          )}
          <FilterChip
            label="+ Filters"
            selected={false}
            onPress={() => setFilterSheetVisible(true)}
          />
        </ScrollView>
        {hasCareers && (
          <Text style={[styles.progress, { color: theme.colors.text.secondary }]}>
            {currentIndex} of {cards.length} reviewed
          </Text>
        )}
      </View>

      <FilterSheet
        visible={filterSheetVisible}
        onClose={() => setFilterSheetVisible(false)}
        onApply={handleFilterApply}
      />

      <View style={styles.cardContainer}>
        {!hasCareers ? (
          <View style={[styles.emptyState, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.emptyTitle, { color: theme.colors.text.primary }]}>
              No careers found
            </Text>
            <Text style={[styles.emptySubtitle, { color: theme.colors.text.secondary }]}>
              Try adjusting your filters
            </Text>
            {hasActiveFilters && (
              <Text
                style={[styles.resetFiltersText, { color: theme.colors.primary }]}
                onPress={() => {
                  resetFilters();
                  setLocation('');
                  setSalaryMin(0);
                  setSalaryMax(1000000);
                }}
              >
                Reset Filters
              </Text>
            )}
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
            {hasActiveFilters && (
              <Text
                style={[styles.resetFiltersText, { color: theme.colors.primary }]}
                onPress={() => {
                  resetFilters();
                  setLocation('');
                  setSalaryMin(0);
                  setSalaryMax(1000000);
                }}
              >
                Reset Filters
              </Text>
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

      <FeedbackModal
        visible={feedbackVisible}
        careerName={currentCareerName}
        onSubmit={handleFeedbackSubmit}
        onClose={() => setFeedbackVisible(false)}
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
  filterBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  } as ViewStyle,
  filterBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
  } as ViewStyle,
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
  resetFiltersText: {
    fontSize: 15,
    fontWeight: '600',
  } as TextStyle,
});
