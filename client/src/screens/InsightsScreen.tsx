import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { CareerROI, RoiResponse } from '../types';
import { apiClient } from '../api/client';
import { CareerDetailView, OccupationIconBadge } from '../components';
import { Button } from '../components/Button';
import { useTheme } from '../hooks/useTheme';
import { formatCurrency, formatPercent } from '../hooks/useFormatters';
import {
  SwipeApiRecord,
  LikedCareer,
  FeedbackSlice,
  computeActivityStats,
  computeFeedbackDistribution,
  computeTasteProfile,
  computeQualityOfInterest,
  computeStandoutPicks,
} from '../utils/insights';
import { getOccupationGroup } from '../utils/occupationGroup';

// The API caps pages at 20 items and ignores page-size params, so approximate
// the national catalog with the first 3 pages (60 top-ROI careers) as the
// comparison baseline.
const CATALOG_PAGES = 3;

const BAR_COLORS = ['#136399', '#059669', '#F59E0B', '#7C3AED', '#DC2626', '#0D9488'];

const FeedbackBar: React.FC<{
  slice: FeedbackSlice;
  index: number;
}> = ({ slice, index }) => {
  const theme = useTheme();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 700,
      delay: index * 120,
      useNativeDriver: false,
    }).start();
  }, [progress, index]);

  const color = BAR_COLORS[index % BAR_COLORS.length];

  return (
    <View style={styles.barRow}>
      <View style={styles.barLabels}>
        <Text style={[styles.barLabel, { color: theme.colors.text.primary }]} numberOfLines={1}>
          {slice.label}
        </Text>
        <Text style={[styles.barPercent, { color: theme.colors.text.secondary }]}>
          {slice.percent}%{slice.count > 1 ? ` · ${slice.count}` : ''}
        </Text>
      </View>
      <View style={[styles.barTrack, { backgroundColor: theme.colors.border }]}>
        <Animated.View
          style={[
            styles.barFill,
            {
              backgroundColor: color,
              width: progress.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', `${Math.max(slice.percent, 4)}%`],
              }),
            },
          ]}
        />
      </View>
    </View>
  );
};

export const InsightsScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [swipes, setSwipes] = useState<SwipeApiRecord[]>([]);
  const [liked, setLiked] = useState<LikedCareer[]>([]);
  const [catalog, setCatalog] = useState<CareerROI[]>([]);
  const [detailCareer, setDetailCareer] = useState<CareerROI | null>(null);
  const fetchKeyRef = useRef(0);

  const fetchInsights = useCallback(async () => {
    const thisFetch = ++fetchKeyRef.current;
    setLoading(true);
    setError(null);

    try {
      const historyJson = await apiClient.getSwipeHistory();
      const likedJson = await apiClient.getLikedCareers();

      // Plain get() rather than getCareers(): getCareers injects user_id, which
      // would exclude the user's own swiped careers from the baseline sample.
      const firstPage = await apiClient.get<RoiResponse>('/api/roi?page=1&sort=roi');
      let catalogRecords: CareerROI[] = firstPage.records || [];
      const totalPages = Math.min(firstPage.pagy?.pages ?? 1, CATALOG_PAGES);
      for (let page = 2; page <= totalPages; page++) {
        const next = await apiClient.get<RoiResponse>(`/api/roi?page=${page}&sort=roi`);
        catalogRecords = catalogRecords.concat(next.records || []);
      }

      if (thisFetch !== fetchKeyRef.current) return;
      setSwipes(historyJson.swipes || []);
      setLiked(likedJson.records || []);
      setCatalog(catalogRecords);
    } catch {
      if (thisFetch === fetchKeyRef.current) {
        setError('Failed to load your insights');
      }
    } finally {
      if (thisFetch === fetchKeyRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchInsights();
    }, [fetchInsights])
  );

  const handleStartExploring = useCallback(() => {
    navigation.navigate('Discover' as never);
  }, [navigation]);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.text.secondary }]}>
          Crunching your swipe history...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
        <Text style={[styles.retryText, { color: theme.colors.primary }]} onPress={fetchInsights}>
          Tap to retry
        </Text>
      </View>
    );
  }

  if (detailCareer) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <CareerDetailView career={detailCareer} onClose={() => setDetailCareer(null)} />
      </View>
    );
  }

  const activity = computeActivityStats(swipes);
  const feedbackDist = computeFeedbackDistribution(swipes);
  const tasteProfile = computeTasteProfile(liked);
  const quality = computeQualityOfInterest(liked, catalog);
  const picks = computeStandoutPicks(liked);

  if (activity.totalReviewed === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: theme.colors.background }]}>
        <Text style={styles.emptyEmoji}>📊</Text>
        <Text style={[styles.emptyTitle, { color: theme.colors.text.primary }]}>
          No insights yet
        </Text>
        <Text style={[styles.emptySubtitle, { color: theme.colors.text.secondary }]}>
          Swipe through some careers and this space will fill up with what you're into
        </Text>
        <Button title="Start Exploring" onPress={handleStartExploring} style={styles.emptyButton} />
      </View>
    );
  }

  const weekChip =
    activity.weekChangePct === null
      ? activity.reviewsThisWeek > 0
        ? 'New this week'
        : null
      : `${activity.weekChangePct >= 0 ? '+' : ''}${Math.round(activity.weekChangePct)}% vs last week`;
  const weekChipColor =
    activity.weekChangePct === null
      ? theme.colors.success
      : activity.weekChangePct >= 0
        ? theme.colors.success
        : theme.colors.error;

  const renderPick = (
    label: string,
    career: CareerROI | null,
    valueLine: string
  ): React.ReactNode => {
    if (!career) return null;
    return (
      <TouchableOpacity
        style={[styles.pickCard, { backgroundColor: theme.colors.surface }]}
        onPress={() => setDetailCareer(career)}
        activeOpacity={0.7}
      >
        <Text style={[styles.pickLabel, { color: theme.colors.primary }]}>{label}</Text>
        <OccupationIconBadge groupName={getOccupationGroup(career.occupation_code)} size={36} />
        <Text style={[styles.pickName, { color: theme.colors.text.primary }]} numberOfLines={2}>
          {career.occupation_name}
        </Text>
        <Text style={[styles.pickValue, { color: theme.colors.text.secondary }]}>{valueLine}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      <View style={[styles.card, { backgroundColor: theme.colors.surface }, theme.shadows.subtle]}>
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.cardTitle, { color: theme.colors.text.primary }]}>Activity</Text>
          {weekChip && (
            <View style={[styles.chip, { backgroundColor: theme.colors.primaryLight }]}>
              <Text style={[styles.chipText, { color: weekChipColor }]}>{weekChip}</Text>
            </View>
          )}
        </View>
        <View style={styles.statGrid}>
          <View style={[styles.statTile]}>
            <Text style={[styles.statValue, { color: theme.colors.text.primary }]}>
              {activity.totalReviewed}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.text.secondary }]}>Reviewed</Text>
          </View>
          <View style={[styles.statTile]}>
            <Text style={[styles.statValue, { color: theme.colors.text.primary }]}>
              {activity.totalLiked}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.text.secondary }]}>Liked</Text>
          </View>
          <View style={[styles.statTile]}>
            <Text style={[styles.statValue, { color: theme.colors.primary }]}>
              {Math.round(activity.likeRate)}%
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.text.secondary }]}>Like rate</Text>
          </View>
          <View style={[styles.statTile]}>
            <Text style={[styles.statValue, { color: theme.colors.text.primary }]}>
              {activity.reviewsThisWeek}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.text.secondary }]}>
              This week
            </Text>
          </View>
        </View>
      </View>

      {feedbackDist.length > 0 ? (
        <View
          style={[styles.card, { backgroundColor: theme.colors.surface }, theme.shadows.subtle]}
        >
          <Text style={[styles.cardTitle, { color: theme.colors.text.primary }]}>
            What you value
          </Text>
          {feedbackDist.map((slice, index) => (
            <FeedbackBar key={slice.key} slice={slice} index={index} />
          ))}
        </View>
      ) : (
        <View
          style={[styles.hintCard, { backgroundColor: theme.colors.surface }, theme.shadows.subtle]}
        >
          <Text style={[styles.hintTitle, { color: theme.colors.text.primary }]}>
            Want deeper insights?
          </Text>
          <Text style={[styles.hintText, { color: theme.colors.text.secondary }]}>
            When you like a career, tell us why — those reasons show up here.
          </Text>
        </View>
      )}

      {tasteProfile.length > 0 && (
        <View
          style={[styles.card, { backgroundColor: theme.colors.surface }, theme.shadows.subtle]}
        >
          <Text style={[styles.cardTitle, { color: theme.colors.text.primary }]}>
            Your taste profile
          </Text>
          <View style={styles.chipWrap}>
            {tasteProfile.map((group) => (
              <View
                key={group.group}
                style={[styles.tasteChip, { borderColor: theme.colors.border }]
                }
              >
                <Text style={[styles.tasteChipText, { color: theme.colors.text.primary }]}>
                  {group.group}
                </Text>
                <Text style={[styles.tasteChipCount, { color: theme.colors.primary }]}>
                  {' '}
                  {group.count}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {quality && (
        <View
          style={[styles.card, { backgroundColor: theme.colors.surface }, theme.shadows.subtle]}
        >
          <Text style={[styles.cardTitle, { color: theme.colors.text.primary }]}>
            Quality of your interest
          </Text>
          <View style={styles.compareRow}>
            <Text style={[styles.compareLabel, { color: theme.colors.text.secondary }]}>
              Avg ROI of likes
            </Text>
            <Text style={[styles.compareValue, { color: theme.colors.text.primary }]}>
              {formatPercent(quality.avgRoi)}{' '}
              <Text style={{ color: theme.colors.text.muted }}>
                vs {formatPercent(quality.catalog.medianRoi)} typical
              </Text>
            </Text>
          </View>
          <View style={styles.compareRow}>
            <Text style={[styles.compareLabel, { color: theme.colors.text.secondary }]}>
              Median salary of likes
            </Text>
            <Text style={[styles.compareValue, { color: theme.colors.text.primary }]}>
              {formatCurrency(quality.medianSalary)}{' '}
              <Text style={{ color: theme.colors.text.muted }}>
                vs {formatCurrency(quality.catalog.medianSalary)} typical
              </Text>
            </Text>
          </View>
          <View style={styles.compareRow}>
            <Text style={[styles.compareLabel, { color: theme.colors.text.secondary }]}>
              Avg break-even of likes
            </Text>
            <Text style={[styles.compareValue, { color: theme.colors.text.primary }]}>
              {quality.avgBreakeven.toFixed(1)}yr{' '}
              <Text style={{ color: theme.colors.text.muted }}>
                vs {quality.catalog.medianBreakeven.toFixed(1)}yr typical
              </Text>
            </Text>
          </View>
          <View style={[styles.insightBox, { backgroundColor: theme.colors.background }]}>
            {quality.insights.map((insight) => (
              <Text key={insight} style={[styles.insightText, { color: theme.colors.success }]}>
                • {insight}
              </Text>
            ))}
          </View>
        </View>
      )}

      {(picks.highestRoi || picks.highestSalary || picks.fastestBreakeven) && (
        <View style={styles.picksSection}>
          <Text style={[styles.cardTitle, { color: theme.colors.text.primary }]}>
            Standout picks
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.picksRow}>
            {renderPick('Highest ROI', picks.highestRoi, formatPercent(picks.highestRoi!.roi_percentage))}
            {renderPick(
              'Highest salary',
              picks.highestSalary,
              formatCurrency(picks.highestSalary!.annual_median_salary)
            )}
            {renderPick(
              'Fastest break-even',
              picks.fastestBreakeven,
              `${picks.fastestBreakeven!.years_to_breakeven}yr`
            )}
          </ScrollView>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  } as ViewStyle,
  content: {
    paddingVertical: 16,
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  } as ViewStyle,
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  } as TextStyle,
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  } as TextStyle,
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  } as TextStyle,
  emptyButton: {
    alignSelf: 'stretch',
  } as ViewStyle,
  card: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
  } as ViewStyle,
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  } as ViewStyle,
  cardTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    marginBottom: 12,
  } as TextStyle,
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
    marginBottom: 12,
  } as ViewStyle,
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  } as TextStyle,
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  } as ViewStyle,
  statTile: {
    width: '50%',
    alignItems: 'center',
    paddingVertical: 8,
  } as ViewStyle,
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
  } as TextStyle,
  statLabel: {
    fontSize: 13,
    marginTop: 2,
  } as TextStyle,
  barRow: {
    marginBottom: 12,
  } as ViewStyle,
  barLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  } as ViewStyle,
  barLabel: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  } as TextStyle,
  barPercent: {
    fontSize: 13,
  } as TextStyle,
  barTrack: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  } as ViewStyle,
  barFill: {
    height: '100%',
    borderRadius: 5,
  } as ViewStyle,
  hintCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  } as ViewStyle,
  hintTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  } as TextStyle,
  hintText: {
    fontSize: 14,
    lineHeight: 19,
  } as TextStyle,
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  } as ViewStyle,
  tasteChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 9999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  } as ViewStyle,
  tasteChipText: {
    fontSize: 13,
    fontWeight: '500',
  } as TextStyle,
  tasteChipCount: {
    fontSize: 13,
    fontWeight: 'bold',
  } as TextStyle,
  compareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  } as ViewStyle,
  compareLabel: {
    fontSize: 14,
    flex: 1,
    marginRight: 8,
  } as TextStyle,
  compareValue: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
  } as TextStyle,
  insightBox: {
    marginTop: 8,
    borderRadius: 8,
    padding: 12,
  } as ViewStyle,
  insightText: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  } as TextStyle,
  picksSection: {
    marginLeft: 16,
    marginBottom: 30,
  } as ViewStyle,
  picksRow: {
    paddingRight: 16,
  } as ViewStyle,
  pickCard: {
    width: 140,
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    alignItems: 'flex-start',
  } as ViewStyle,
  pickLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 8,
  } as TextStyle,
  pickName: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    minHeight: 34,
  } as TextStyle,
  pickValue: {
    fontSize: 13,
    marginTop: 4,
  } as TextStyle,
});
