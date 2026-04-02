import React, { useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, runOnJS, withSpring } from 'react-native-reanimated';
import { useTheme } from '../hooks/useTheme';
import { CareerROI } from '../types';
import { OccupationIconBadge } from './OccupationIconBadge';
import { getOccupationGroup } from '../utils/occupationGroup';

interface SwipeCardProps {
  career: CareerROI;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onViewDetails?: () => void;
  cardKey?: string | number;
  shouldReset?: number;
}

const SWIPE_THRESHOLD = 100;

export const SwipeCard: React.FC<SwipeCardProps> = ({ career, onSwipeLeft, onSwipeRight, onViewDetails, cardKey: _cardKey, shouldReset }) => {
  const theme = useTheme();
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const resetPosition = useCallback(() => {
    'worklet';
    translateX.value = 0;
    translateY.value = 0;
    scale.value = 1;
    opacity.value = 1;
  }, []);

  useEffect(() => {
    if (shouldReset) {
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      scale.value = withSpring(1);
    }
  }, [shouldReset]);

  const formatCurrency = (value: string) => {
    const num = parseFloat(value.replace(/[^0-9.-]/g, ''));
    if (isNaN(num)) return value;
    return `$${num.toLocaleString()}`;
  };

  const handleSwipeLeft = () => {
    onSwipeLeft?.();
  };

  const handleSwipeRight = () => {
    onSwipeRight?.();
  };

  const handleViewDetails = () => {
    onViewDetails?.();
  };

  const tapGesture = Gesture.Tap()
    .onEnd(() => {
      runOnJS(handleViewDetails)();
    });

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY * 0.3;
    })
    .onEnd((event) => {
      if (event.translationX > SWIPE_THRESHOLD) {
        translateX.value = withSpring(300, {}, () => {
          resetPosition();
          runOnJS(handleSwipeRight)();
        });
      } else if (event.translationX < -SWIPE_THRESHOLD) {
        translateX.value = withSpring(-300, {}, () => {
          resetPosition();
          runOnJS(handleSwipeLeft)();
        });
      } else {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
    });

  const composedGesture = Gesture.Race(panGesture, tapGesture);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${translateX.value * 0.05}deg` },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View style={[styles.card, { backgroundColor: theme.colors.surface }, theme.shadows.card, cardStyle]}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <OccupationIconBadge groupName={getOccupationGroup(career.occupation_code)} size={44} />
            <View style={styles.headerText}>
              <Text style={[styles.occupationName, { color: theme.colors.text.primary }]}>
                {career.occupation_name}
              </Text>
              <Text style={[styles.areaName, { color: theme.colors.text.secondary }]}>
                {career.area_name}
              </Text>
            </View>
          </View>
        </View>

        {career.day_in_life_summary && (
          <View style={styles.narrativeContainer}>
            <Text style={[styles.narrativeText, { color: theme.colors.text.primary }]}>
              {career.day_in_life_summary}
            </Text>
          </View>
        )}

        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: theme.colors.text.secondary }]}>Annual Salary</Text>
            <Text style={[styles.statValue, { color: theme.colors.text.primary }]}>
              {formatCurrency(career.annual_median_salary)}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: theme.colors.text.secondary }]}>Education Cost</Text>
            <Text style={[styles.statValue, { color: theme.colors.text.primary }]}>
              {formatCurrency(career.education_cost)}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: theme.colors.text.secondary }]}>Break-even</Text>
            <Text style={[styles.statValue, { color: theme.colors.text.primary }]}>
              {career.years_to_breakeven} years
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: theme.colors.text.secondary }]}>Job Zone</Text>
            <Text style={[styles.statValue, { color: theme.colors.text.primary }]}>
              {career.job_zone}
            </Text>
          </View>
        </View>

        <Text style={[styles.hint, { color: theme.colors.text.secondary }]}>
          Tap for details, swipe to continue
        </Text>
      </Animated.View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  card: {
    margin: 20,
    borderRadius: 16,
    padding: 20,
  } as ViewStyle,
  header: {
    marginBottom: 16,
  } as ViewStyle,
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  } as ViewStyle,
  headerText: {
    flex: 1,
  } as ViewStyle,
  occupationName: {
    fontSize: 22,
    fontWeight: 'bold',
  } as TextStyle,
  areaName: {
    fontSize: 14,
    marginTop: 4,
  } as TextStyle,
  narrativeContainer: {
    marginBottom: 16,
  } as ViewStyle,
  narrativeText: {
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'left',
  } as TextStyle,
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  } as ViewStyle,
  statItem: {
    width: '50%',
    paddingVertical: 8,
  } as ViewStyle,
  statLabel: {
    fontSize: 12,
    marginBottom: 4,
  } as TextStyle,
  statValue: {
    fontSize: 16,
    fontWeight: '600',
  } as TextStyle,
  hint: {
    textAlign: 'center',
    fontSize: 13,
  } as TextStyle,
});
