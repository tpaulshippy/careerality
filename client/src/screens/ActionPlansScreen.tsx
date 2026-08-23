import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ImageStyle,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  Linking,
  Platform,
  Animated as RNAnimated,
  Alert,
} from 'react-native';
import * as ExpoClipboard from 'expo-clipboard';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { CareerROI } from '../types';
import { apiClient } from '../api/client';
import { CareerDetailView, FilterChip, OccupationIconBadge } from '../components';
import { useTheme } from '../hooks/useTheme';
import { usePlanProgress } from '../hooks/usePlanProgress';
import { buildPlan, PlanStep } from '../utils/actionPlan';
import { getOccupationGroup } from '../utils/occupationGroup';
import { getImageUrl } from '../utils/careerImage';

interface LikedRecord extends CareerROI {
  swipe_id: number;
}

interface RouteParams {
  occupationCode?: string;
}

type PlanFilter = 'all' | 'in_progress' | 'done';

const FILTER_LABELS: Record<PlanFilter, string> = {
  all: 'All',
  in_progress: 'In progress',
  done: 'Done',
};

/* ---------- Progress ring (pure views: pie wedges clipped to a circle) ---------- */

interface WedgeProps {
  size: number;
  startDeg: number;
  sweepDeg: number;
  color: string;
}

/**
 * Circular wedge without SVG: two nested rotating half-plane clips intersect
 * into a wedge, trimmed by the parent's circular overflow clip.
 * Angles are measured clockwise from 12 o'clock.
 */
const PieWedge: React.FC<WedgeProps> = ({ size, startDeg, sweepDeg, color }) => {
  const outerRotation = Math.round((startDeg + sweepDeg - 270) * 100) / 100;
  const innerRotation = Math.round((startDeg - 90) * 100) / 100;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: size,
        height: size,
        transform: [{ rotate: `${outerRotation}deg` }],
      }}
    >
      <View style={{ position: 'absolute', left: 0, top: 0, width: size / 2, height: size, overflow: 'hidden' }}>
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: size,
            height: size,
            transform: [{ rotate: `${innerRotation}deg` }],
          }}
        >
          <View style={{ position: 'absolute', left: 0, top: 0, width: size / 2, height: size, overflow: 'hidden' }}>
            <View style={{ position: 'absolute', left: 0, top: 0, width: size, height: size, backgroundColor: color }} />
          </View>
        </View>
      </View>
    </View>
  );
};

interface ProgressRingProps {
  progress: number;
  size: number;
  thickness: number;
  color: string;
  trackColor: string;
  holeColor: string;
  labelColor: string;
  showLabel?: boolean;
}

export const ProgressRing: React.FC<ProgressRingProps> = ({
  progress,
  size,
  thickness,
  color,
  trackColor,
  holeColor,
  labelColor,
  showLabel = true,
}) => {
  const clamped = Math.min(1, Math.max(0, progress));
  const deg = Math.round(clamped * 360 * 100) / 100;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: 'hidden',
          backgroundColor: trackColor,
        }}
      >
        {deg >= 180 && (
          <View style={{ position: 'absolute', left: 0, top: 0, width: size, height: size, backgroundColor: color }} />
        )}
        {deg > 0 && deg < 180 && <PieWedge size={size} startDeg={0} sweepDeg={deg} color={color} />}
        {deg >= 180 && deg < 360 && <PieWedge size={size} startDeg={deg} sweepDeg={360 - deg} color={trackColor} />}
      </View>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: size - thickness * 2,
          height: size - thickness * 2,
          borderRadius: (size - thickness * 2) / 2,
          backgroundColor: holeColor,
        }}
      />
      {showLabel && <Text style={[styles.ringLabel, { color: labelColor }]}>{Math.round(clamped * 100)}%</Text>}
    </View>
  );
};

/* ---------- Helpers ---------- */

const copyToClipboard = async (text: string): Promise<boolean> => {
  if (Platform.OS !== 'web') {
    // navigator.clipboard does not exist in the native runtimes.
    try {
      await ExpoClipboard.setStringAsync(text);
      return true;
    } catch {
      return false;
    }
  }
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to manual copy prompt
  }
  return false;
};

const openUrl = (url: string) => {
  Linking.openURL(url).catch(() => {
    Alert.alert('Unable to open link', url);
  });
};

/* ---------- Screen ---------- */

export const ActionPlansScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation<{ navigate: (name: string, params?: RouteParams) => void }>();
  const route = useRoute();
  const routeParams = (route.params ?? {}) as RouteParams;
  const [records, setRecords] = useState<LikedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [filter, setFilter] = useState<PlanFilter>('all');
  const fetchKeyRef = useRef(0);
  const usePlanProgressApi = usePlanProgress();
  const { isComplete, progressFor } = usePlanProgressApi;

  const fetchLikedCareers = useCallback(async () => {
    const thisFetch = ++fetchKeyRef.current;
    setLoading(true);
    setError(null);

    try {
      const json = await apiClient.getLikedCareers() as { records: LikedRecord[] };
      if (thisFetch !== fetchKeyRef.current) return;
      setRecords(json.records || []);
    } catch {
      if (thisFetch === fetchKeyRef.current) {
        setError('Failed to load your liked careers');
      }
    } finally {
      if (thisFetch === fetchKeyRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchLikedCareers();
    }, [fetchLikedCareers])
  );

  useEffect(() => {
    if (routeParams.occupationCode) {
      setSelectedCode(routeParams.occupationCode);
    }
  }, [routeParams]);

  const plans = useMemo(() => {
    const byCode = new Map<string, CareerROI>();
    for (const record of records) {
      if (!byCode.has(record.occupation_code)) {
        byCode.set(record.occupation_code, record);
      }
    }
    return Array.from(byCode.entries()).map(([code, career]) => ({
      code,
      career,
      plan: buildPlan(career),
    }));
  }, [records]);

  const visiblePlans = useMemo(() => {
    const withProgress = plans.map(p => ({ ...p, progress: progressFor(p.code) }));
    const filtered = withProgress.filter(({ progress }) => {
      if (filter === 'done') return progress >= 1;
      if (filter === 'in_progress') return progress > 0 && progress < 1;
      return true;
    });
    return filtered.sort((x, y) => {
      if (x.progress !== y.progress) return x.progress - y.progress;
      return x.career.occupation_name.localeCompare(y.career.occupation_name);
    });
  }, [plans, filter, progressFor]);

  const selectedCareer = useMemo(
    () => (selectedCode ? records.find(r => r.occupation_code === selectedCode) ?? null : null),
    [selectedCode, records]
  );

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.text.secondary }]}>
          Loading action plans...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
        <Text style={[styles.retryText, { color: theme.colors.primary }]} onPress={fetchLikedCareers}>
          Tap to retry
        </Text>
      </View>
    );
  }

  if (selectedCareer) {
    return (
      <PlanDetailView
        career={selectedCareer}
        progress={usePlanProgressApi}
        onClose={() => setSelectedCode(null)}
      />
    );
  }

  if (records.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyTitle, { color: theme.colors.text.primary }]}>No action plans yet</Text>
          <Text style={[styles.emptySubtitle, { color: theme.colors.text.secondary }]}>
            Like a few careers in Discover and each one gets its own six-step readiness plan here.
          </Text>
          <TouchableOpacity
            style={[styles.emptyButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => navigation.navigate('Discover')}
          >
            <Text style={styles.emptyButtonText}>Browse careers</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const emptyFilterCopy: Record<Exclude<PlanFilter, 'all'>, string> = {
    in_progress: 'No plans are underway yet. Open one below and take the first step.',
    done: 'Nothing finished yet — every plan starts with a single step.',
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.list}>
        <Text style={[styles.screenIntro, { color: theme.colors.text.secondary }]}>
          Six concrete steps to get ready for each career you love — take them in any order.
        </Text>

        <View style={styles.filterRow}>
          {(Object.keys(FILTER_LABELS) as PlanFilter[]).map(key => (
            <FilterChip
              key={key}
              label={FILTER_LABELS[key]}
              selected={filter === key}
              onPress={() => setFilter(key)}
            />
          ))}
        </View>

        {visiblePlans.length === 0 ? (
          <View style={styles.filterEmptyContainer}>
            <Text style={[styles.filterEmptyText, { color: theme.colors.text.secondary }]}>
              {emptyFilterCopy[filter as Exclude<PlanFilter, 'all'>]}
            </Text>
            <TouchableOpacity onPress={() => setFilter('all')} testID="show-all-chip">
              <Text style={[styles.filterEmptyLink, { color: theme.colors.primary }]}>Show all plans</Text>
            </TouchableOpacity>
          </View>
        ) : (
          visiblePlans.map((planEntry, index) => {
            const nextStep =
              planEntry.plan.steps.find(step => !isComplete(planEntry.code, step.id)) ?? null;
            const percent = Math.round(planEntry.progress * 100);
            return (
              <TouchableOpacity
                key={planEntry.code}
                style={[styles.card, { backgroundColor: theme.colors.surface }, theme.shadows.subtle]}
                onPress={() => setSelectedCode(planEntry.code)}
                activeOpacity={0.7}
                testID={`plan-row-${index}`}
              >
                <CareerThumbnail career={planEntry.career} />
                <View style={styles.rowTextContainer}>
                  <Text style={[styles.rowName, { color: theme.colors.text.primary }]} numberOfLines={1}>
                    {planEntry.career.occupation_name}
                  </Text>
                  <Text style={[styles.rowTeaser, { color: theme.colors.text.secondary }]} numberOfLines={2}>
                    {nextStep ? `Try: ${nextStep.title}` : 'All steps complete'}
                  </Text>
                  <Text style={[styles.rowCount, { color: theme.colors.text.muted }]}>
                    {`${percent}% of 6 steps`}
                  </Text>
                </View>
                <ProgressRing
                  progress={planEntry.progress}
                  size={54}
                  thickness={5}
                  color={planEntry.progress >= 1 ? theme.colors.success : theme.colors.primary}
                  trackColor={theme.colors.border}
                  holeColor={theme.colors.surface}
                  labelColor={theme.colors.text.primary}
                />
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
};

/* ---------- Thumbnail with graceful fallback ---------- */

const CareerThumbnail: React.FC<{ career: CareerROI }> = ({ career }) => {
  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl = getImageUrl(career.occupation_code);

  useEffect(() => {
    setImageFailed(false);
  }, [imageUrl]);

  if (imageFailed) {
    return (
      <View style={styles.thumbFallback}>
        <OccupationIconBadge groupName={getOccupationGroup(career.occupation_code)} size={44} />
      </View>
    );
  }

  return (
    <Image
      source={{ uri: imageUrl }}
      style={styles.thumbnail}
      resizeMode="cover"
      onError={() => setImageFailed(true)}
    />
  );
};

/* ---------- Plan detail ---------- */

interface StepRowProps {
  step: PlanStep;
  index: number;
  checked: boolean;
  onToggle: () => void;
  chips: string[];
}

const StepRow: React.FC<StepRowProps> = ({ step, index, checked, onToggle, chips }) => {
  const theme = useTheme();
  const checkScale = useRef(new RNAnimated.Value(checked ? 1 : 0)).current;
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    RNAnimated.spring(checkScale, {
      toValue: checked ? 1 : 0,
      friction: 6,
      tension: 60,
      useNativeDriver: false,
    }).start();
  }, [checked, checkScale]);

  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    []
  );

  const handleCopy = useCallback(async () => {
    if (!step.copyText) return;
    let ok = false;
    try {
      ok = await copyToClipboard(step.copyText);
    } catch {
      ok = false;
    }
    if (!ok) {
      Alert.alert('Copy manually', step.copyText);
      return;
    }
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 2000);
  }, [step.copyText]);

  return (
    <View style={[styles.stepCard, { backgroundColor: theme.colors.surface }, theme.shadows.subtle]}>
      <TouchableOpacity
        style={styles.stepHeader}
        onPress={onToggle}
        activeOpacity={0.7}
        testID={`step-checkbox-${index}`}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
      >
        <View
          style={[styles.checkbox, { borderColor: checked ? theme.colors.success : theme.colors.border }]}
        >
          <RNAnimated.Text
            style={[styles.checkmark, { color: theme.colors.success, transform: [{ scale: checkScale }] }]}
          >
            ✓
          </RNAnimated.Text>
        </View>
        <View style={styles.stepHeaderText}>
          <Text
            style={[
              styles.stepTitle,
              { color: checked ? theme.colors.text.muted : theme.colors.text.primary },
              checked && styles.stepTitleDone,
            ]}
          >
            {step.title}
          </Text>
          {chips.map(chip => (
            <View key={chip} style={[styles.chipBadge, { backgroundColor: theme.colors.primaryLight }]}>
              <Text style={[styles.chipBadgeText, { color: theme.colors.primaryDark }]}>{chip}</Text>
            </View>
          ))}
        </View>
      </TouchableOpacity>

      <Text
        style={[
          styles.stepDescription,
          { color: checked ? theme.colors.text.muted : theme.colors.text.secondary },
          checked && styles.stepTitleDone,
        ]}
      >
        {step.description}
      </Text>
      <Text style={[styles.stepWhy, { color: theme.colors.text.muted }]}>Why: {step.why}</Text>

      {(step.url || step.copyText) && !checked && (
        <View style={styles.stepActions}>
          {step.url && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.colors.primaryLight }]}
              onPress={() => openUrl(step.url!)}
              testID={`step-open-${index}`}
            >
              <Text style={[styles.actionButtonText, { color: theme.colors.primaryDark }]}>Open ↗</Text>
            </TouchableOpacity>
          )}
          {step.copyText && (
            <TouchableOpacity
              style={[
                styles.actionButton,
                { backgroundColor: copied ? theme.colors.success : theme.colors.primaryLight },
              ]}
              onPress={handleCopy}
              testID={`step-copy-${index}`}
            >
              <Text
                style={[
                  styles.actionButtonText,
                  { color: copied ? '#FFFFFF' : theme.colors.primaryDark },
                ]}
              >
                {copied ? 'Copied ✓' : 'Copy message'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

const PlanDetailView: React.FC<{
  career: CareerROI;
  onClose: () => void;
  progress: ReturnType<typeof usePlanProgress>;
}> = ({ career, onClose, progress }) => {
  const theme = useTheme();
  const { toggleStep, isComplete, progressFor } = progress;
  const [showCareerDetails, setShowCareerDetails] = useState(false);
  const plan = useMemo(() => buildPlan(career), [career]);
  const completion = progressFor(career.occupation_code);

  const chipsByStepId: Record<string, string[]> = {
    'find-openings':
      career.avg_annual_openings != null
        ? [`≈${career.avg_annual_openings.toLocaleString('en-US')} openings/yr`]
        : [],
    'check-outlook':
      career.projected_growth_percent != null
        ? [
            `${career.projected_growth_percent > 0 ? '+' : ''}${career.projected_growth_percent}% projected growth`,
          ]
        : [],
  };

  if (showCareerDetails) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <CareerDetailView career={career} onClose={() => setShowCareerDetails(false)} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.detailContent}>
        <TouchableOpacity onPress={onClose} style={styles.backButton} testID="back-to-plans">
          <Text style={[styles.backButtonText, { color: theme.colors.primary }]}>← All plans</Text>
        </TouchableOpacity>

        <View style={[styles.detailHeader, { backgroundColor: theme.colors.surface }, theme.shadows.subtle]}>
          <ProgressRing
            progress={completion}
            size={72}
            thickness={6}
            color={completion >= 1 ? theme.colors.success : theme.colors.primary}
            trackColor={theme.colors.border}
            holeColor={theme.colors.surface}
            labelColor={theme.colors.text.primary}
          />
          <View style={styles.detailHeaderText}>
            <Text style={[styles.detailName, { color: theme.colors.text.primary }]} numberOfLines={2}>
              {career.occupation_name}
            </Text>
            <Text style={[styles.detailArea, { color: theme.colors.text.secondary }]} numberOfLines={1}>
              {career.area_name}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => setShowCareerDetails(true)}
          style={styles.careerDetailsLink}
          testID="open-career-details"
        >
          <Text style={[styles.careerDetailsLinkText, { color: theme.colors.primary }]}>
            Open career details →
          </Text>
        </TouchableOpacity>

        {plan.steps.map((step, index) => (
          <StepRow
            key={step.id}
            step={step}
            index={index}
            checked={isComplete(career.occupation_code, step.id)}
            onToggle={() => toggleStep(career.occupation_code, step.id)}
            chips={chipsByStepId[step.id] ?? []}
          />
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 } as ViewStyle,
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  } as ViewStyle,
  loadingText: { marginTop: 16, fontSize: 15 } as TextStyle,
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  } as ViewStyle,
  errorText: { fontSize: 16, textAlign: 'center', marginBottom: 12 } as TextStyle,
  retryText: { fontSize: 16, fontWeight: '600' } as TextStyle,
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  } as ViewStyle,
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
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  } as ViewStyle,
  emptyButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' } as TextStyle,
  list: { paddingVertical: 16 } as ViewStyle,
  screenIntro: {
    fontSize: 14,
    marginHorizontal: 16,
    marginBottom: 4,
  } as TextStyle,
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingTop: 8,
  } as ViewStyle,
  filterEmptyContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
  } as ViewStyle,
  filterEmptyText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 20,
  } as TextStyle,
  filterEmptyLink: { fontSize: 14, fontWeight: '600' } as TextStyle,
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 12,
  } as ViewStyle,
  thumbnail: { width: 48, height: 48, borderRadius: 8 } as ImageStyle,
  thumbFallback: {
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  rowTextContainer: { flex: 1, marginHorizontal: 12 } as ViewStyle,
  rowName: { fontSize: 15, fontWeight: 'bold' } as TextStyle,
  rowTeaser: { fontSize: 13, marginTop: 3, lineHeight: 17 } as TextStyle,
  rowCount: { fontSize: 12, marginTop: 3 } as TextStyle,
  ringLabel: { fontSize: 11, fontWeight: '700' } as TextStyle,
  detailContent: { paddingBottom: 32 } as ViewStyle,
  backButton: { padding: 16 } as ViewStyle,
  backButtonText: { fontSize: 16, fontWeight: '500' } as TextStyle,
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 16,
    gap: 16,
  } as ViewStyle,
  detailHeaderText: { flex: 1 } as ViewStyle,
  detailName: { fontSize: 19, fontWeight: 'bold' } as TextStyle,
  detailArea: { fontSize: 13, marginTop: 3 } as TextStyle,
  careerDetailsLink: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  } as ViewStyle,
  careerDetailsLinkText: { fontSize: 14, fontWeight: '600' } as TextStyle,
  stepCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 14,
  } as ViewStyle,
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  } as ViewStyle,
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  } as ViewStyle,
  checkmark: { fontSize: 16, fontWeight: 'bold', lineHeight: 18 } as TextStyle,
  stepHeaderText: {
    flex: 1,
    marginLeft: 10,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  } as ViewStyle,
  stepTitle: { fontSize: 15, fontWeight: '600' } as TextStyle,
  stepTitleDone: { textDecorationLine: 'line-through' } as TextStyle,
  chipBadge: {
    borderRadius: 9999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  } as ViewStyle,
  chipBadgeText: { fontSize: 11, fontWeight: '600' } as TextStyle,
  stepDescription: { fontSize: 13, lineHeight: 18, marginTop: 8 } as TextStyle,
  stepWhy: { fontSize: 12, fontStyle: 'italic', marginTop: 6 } as TextStyle,
  stepActions: { flexDirection: 'row', marginTop: 10, gap: 8 } as ViewStyle,
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  } as ViewStyle,
  actionButtonText: { fontSize: 13, fontWeight: '600' } as TextStyle,
});


