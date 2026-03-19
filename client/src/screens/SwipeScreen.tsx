import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { CareerROI } from '../types';
import { API_URL } from '../constants/dataSources';
import { useSwipe } from '../hooks/useSwipe';
import { useFilters } from '../hooks/useFilters';
import { SwipeCard } from '../components/SwipeCard';
import { SwipeControls } from '../components/SwipeControls';
import { FilterSheet } from '../components/FilterSheet';
import { FeedbackModal, InterestLevel } from '../components/FeedbackModal';
import { Loading, ErrorView } from '../components';
import { useTheme } from '../hooks/useTheme';

export const SwipeScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [careers, setCareers] = useState<CareerROI[]>([]);
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [currentCareerName, setCurrentCareerName] = useState('');

  const { filters, setLocation, setSalaryMin, setSalaryMax } = useFilters();
  const { cards, swipeLeft, swipeRight, undo, currentIndex, resetSwipes } = useSwipe(careers);

  const fetchCareers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.location) params.append('area_code', filters.location);
      if (filters.salaryMin > 0) params.append('min_salary', filters.salaryMin.toString());
      if (filters.salaryMax < 1000000) params.append('max_salary', filters.salaryMax.toString());

      const url = `${API_URL}?${params.toString()}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch careers');
      }
      const json = await response.json();
      const data: CareerROI[] = json.records || json;
      setCareers(data);
    } catch (err) {
      setError('Failed to load careers');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filters.location, filters.salaryMin, filters.salaryMax]);

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

  const handleSwipeLeft = () => {
    const career = swipeLeft();
    if (career) {
      setCurrentCareerName(career.occupation_name);
      setFeedbackVisible(true);
      submitSwipe(career.id, 'left');
    }
  };

  const handleSwipeRight = () => {
    const career = swipeRight();
    if (career) {
      setCurrentCareerName(career.occupation_name);
      setFeedbackVisible(true);
      submitSwipe(career.id, 'right');
    }
  };

  const submitSwipe = async (careerId: number, direction: 'left' | 'right') => {
    try {
      await fetch('/api/swipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ career_id: careerId, direction }),
      });
    } catch (err) {
      console.error('Failed to submit swipe:', err);
    }
  };

  const handleFeedbackSubmit = async (interest: InterestLevel, notes: string) => {
    setFeedbackVisible(false);
  };

  const handleFilterApply = (filterState: { location: string; minSalary: string; maxSalary: string }) => {
    setLocation(filterState.location);
    setSalaryMin(filterState.minSalary ? parseInt(filterState.minSalary, 10) : 0);
    setSalaryMax(filterState.maxSalary ? parseInt(filterState.maxSalary, 10) : 1000000);
  };

  const handleUndo = () => {
    undo();
  };

  const currentCard = cards[currentIndex];

  if (loading) {
    return <Loading message="Loading careers to explore..." />;
  }

  if (error) {
    return <ErrorView message={error} onRetry={fetchCareers} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text.primary }]}>Swipe Careers</Text>
        <Text style={[styles.subtitle, { color: theme.colors.text.secondary }]}>
          {currentIndex} of {cards.length} reviewed
        </Text>
      </View>

      <FilterSheet
        visible={filterSheetVisible}
        onClose={() => setFilterSheetVisible(false)}
        onApply={handleFilterApply}
      />

      <View style={styles.cardContainer}>
        {currentCard ? (
          <SwipeCard
            career={currentCard}
            onSwipeLeft={handleSwipeLeft}
            onSwipeRight={handleSwipeRight}
          />
        ) : (
          <View style={[styles.emptyState, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.emptyTitle, { color: theme.colors.text.primary }]}>
              All done!
            </Text>
            <Text style={[styles.emptySubtitle, { color: theme.colors.text.secondary }]}>
              You've reviewed all available careers
            </Text>
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
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  } as ViewStyle,
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  } as TextStyle,
  subtitle: {
    fontSize: 14,
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
  } as TextStyle,
});
