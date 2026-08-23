import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TextStyle,
  View,
  ViewStyle,
  ImageStyle,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Svg, Path } from 'react-native-svg';
import { apiClient } from '../api/client';
import { RoiResponse, CareerROI } from '../types';
import { useTheme } from '../hooks/useTheme';
import { useFilters } from '../hooks/useFilters';
import { Button, FilterChip } from '../components';
import { getImageUrl } from '../utils/careerImage';
import {
  METRICS,
  MetricKey,
  StateMetrics,
  colorForMetrics,
  computeDomain,
  computeStateMetrics,
  formatLegendLabel,
  formatMetricValue,
  getColorValue,
  getStateMetricValue,
} from '../utils/mapMetrics';
import {
  US_MAP_VIEWBOX,
  US_STATES_PATHS,
  US_STATES_PATHS_SOURCE,
} from '../constants/usStatesPaths';

/** Light-mode sequential ramp: near-white → theme primary. */
const LIGHT_RAMP = ['#EBF3F8', '#BFDCEC', '#7FB4D2', '#3E8BB5', '#136399'];
/** Dark-mode ramp: deep navy → bright blue so states stay legible on dark bg. */
const DARK_RAMP = ['#16324F', '#1E4A73', '#2A6699', '#4187BF', '#6FAFD8'];

const MAX_PAGES_PER_STATE = 3;
const FETCH_CONCURRENCY = 6;

interface MapData {
  metrics: Record<string, StateMetrics>;
  topCareers: Record<string, CareerROI[]>;
}

/** The API indexes areas with unpadded FIPS codes ("1"), our paths use padded ones ("01"). */
const toApiFips = (fips: string): string => fips.replace(/^0+/, '') || fips;

const fetchStateRecords = async (fips: string): Promise<CareerROI[]> => {
  const apiCode = toApiFips(fips);
  const first = await apiClient.get<RoiResponse>(
    `/api/roi?area_code=${encodeURIComponent(apiCode)}&page=1`,
  );
  const records = [...(first.records ?? [])];
  const pages = Math.min(first.pagy?.pages ?? 1, MAX_PAGES_PER_STATE);
  for (let page = 2; page <= pages; page++) {
    const next = await apiClient.get<RoiResponse>(
      `/api/roi?area_code=${encodeURIComponent(apiCode)}&page=${page}`,
    );
    records.push(...(next.records ?? []));
  }
  return records;
};

const buildMapData = async (
  fipsList: string[],
  onProgress: (done: number, total: number) => void,
): Promise<{ data: MapData; failures: number }> => {
  const metrics: Record<string, StateMetrics> = {};
  const topCareers: Record<string, CareerROI[]> = {};
  const queue = [...fipsList];
  let done = 0;
  let failures = 0;

  const worker = async () => {
    while (queue.length > 0) {
      const fips = queue.shift();
      if (fips === undefined) break;
      try {
        let records: CareerROI[] = [];
        try {
          records = await fetchStateRecords(fips);
        } catch {
          records = await fetchStateRecords(fips);
        }
        if (records.length > 0) {
          metrics[fips] = computeStateMetrics(records);
          topCareers[fips] = [...records]
            .sort((a, b) => (Number(b.roi_percentage) || 0) - (Number(a.roi_percentage) || 0))
            .slice(0, 5);
        }
      } catch {
        failures += 1;
      }
      done += 1;
      onProgress(done, fipsList.length);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(FETCH_CONCURRENCY, fipsList.length) }, worker),
  );
  return { data: { metrics, topCareers }, failures };
};

export const MapScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation();
  const { setStateCode } = useFilters();

  const [metricKey, setMetricKey] = useState<MetricKey>('avg_salary');
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [progress, setProgress] = useState({ done: 0, total: US_STATES_PATHS.length });
  const [data, setData] = useState<MapData>({ metrics: {}, topCareers: {} });
  const [selectedFips, setSelectedFips] = useState<string | null>(null);
  const sheetTranslate = useRef(new Animated.Value(320)).current;

  const loadMap = useCallback(async () => {
    setStatus('loading');
    setProgress({ done: 0, total: US_STATES_PATHS.length });
    try {
      const { data: result, failures } = await buildMapData(
        US_STATES_PATHS.map(s => s.fips),
        (d, t) => setProgress({ done: d, total: t }),
      );
      if (failures >= US_STATES_PATHS.length) {
        setStatus('error');
        return;
      }
      setData(result);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    loadMap();
  }, [loadMap]);

  const domain = useMemo(() => {
    const values = US_STATES_PATHS.map(s => getColorValue(data.metrics[s.fips], metricKey));
    return computeDomain(values);
  }, [data.metrics, metricKey]);

  const ramp = theme.isDark ? DARK_RAMP : LIGHT_RAMP;
  const activeMetric = METRICS.find(m => m.key === metricKey) ?? METRICS[0];

  const legendLabels = useMemo(() => {
    if (!domain) return null;
    // Inverted metrics negate the color value; undo that for display labels.
    const sign = activeMetric.inverted ? -1 : 1;
    return {
      min: formatLegendLabel(metricKey, sign * domain.min),
      max: formatLegendLabel(metricKey, sign * domain.max),
    };
  }, [domain, metricKey, activeMetric.inverted]);

  useEffect(() => {
    if (selectedFips !== null) {
      Animated.timing(sheetTranslate, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start();
    } else {
      sheetTranslate.setValue(320);
    }
  }, [selectedFips, sheetTranslate]);

  const handleExplore = useCallback(() => {
    if (selectedFips === null) return;
    // Discover queries the API with area codes, which are unpadded FIPS.
    const apiCode = toApiFips(selectedFips);
    setStateCode(apiCode);
    setSelectedFips(null);
    // Discover may already be mounted, where the persisted filter alone
    // wouldn't trigger a refetch - pass it through as a param as well.
    navigation.navigate({ name: 'Discover', params: { stateCode: apiCode } } as never);
  }, [selectedFips, setStateCode, navigation]);

  const selectedState = US_STATES_PATHS.find(s => s.fips === selectedFips);
  const selectedMetrics = selectedFips ? data.metrics[selectedFips] : undefined;
  const selectedValue = getStateMetricValue(selectedMetrics, metricKey);
  const selectedTopCareers =
    selectedFips !== null ? data.topCareers[selectedFips] ?? [] : [];

  if (status === 'loading') {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.skeletonMap, { backgroundColor: theme.colors.surface }]} />
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.text.secondary }]}>
            Loading state data… {progress.done}/{progress.total}
          </Text>
        </View>
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.errorText, { color: theme.colors.error }]}>
          Failed to load state career data
        </Text>
        <Button title="Retry" onPress={loadMap} style={styles.retryButton} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.chipRow}>
          {METRICS.map(metric => (
            <FilterChip
              key={metric.key}
              label={metric.label}
              selected={metric.key === metricKey}
              onPress={() => setMetricKey(metric.key)}
            />
          ))}
        </View>

        <View
          style={[
            styles.mapCard,
            { backgroundColor: theme.colors.surface },
            theme.shadows.card,
          ]}
        >
          <Svg
            viewBox={`0 0 ${US_MAP_VIEWBOX.width} ${US_MAP_VIEWBOX.height}`}
            width="100%"
            style={styles.mapSvg}
          >
            {US_STATES_PATHS.map(state => {
              const fill = colorForMetrics(data.metrics[state.fips], metricKey, domain, ramp);
              const isSelected = state.fips === selectedFips;
              return (
                <Path
                  key={state.fips}
                  d={state.d}
                  fill={fill ?? (theme.isDark ? '#374151' : '#D1D5DB')}
                  stroke={isSelected ? theme.colors.primaryDark : theme.isDark ? '#111827' : '#FFFFFF'}
                  strokeWidth={isSelected ? 2.5 : 0.8}
                  onPress={() => setSelectedFips(state.fips)}
                />
              );
            })}
          </Svg>

          <View style={[styles.legendRow, { borderTopColor: theme.colors.border }]}>
            <Text style={[styles.legendTitle, { color: theme.colors.text.secondary }]}>
              {activeMetric.label}
            </Text>
            <View style={styles.legendBarWrap}>
              {legendLabels ? (
                <>
                  <Text style={[styles.legendLabel, { color: theme.colors.text.secondary }]}>
                    {legendLabels.min}
                  </Text>
                  <View style={[styles.legendBar, { borderColor: theme.colors.border }]}>
                    {ramp.map(color => (
                      <View key={color} style={[styles.legendSegment, { backgroundColor: color }]} />
                    ))}
                  </View>
                  <Text style={[styles.legendLabel, { color: theme.colors.text.secondary }]}>
                    {legendLabels.max}
                  </Text>
                </>
              ) : (
                <Text style={[styles.legendLabel, { color: theme.colors.text.secondary }]}>
                  No data available yet
                </Text>
              )}
            </View>
          </View>
        </View>

        <Text style={[styles.sourceNote, { color: theme.colors.text.muted }]}>
          {US_STATES_PATHS_SOURCE}
        </Text>
      </ScrollView>

      {selectedState && (
        <Animated.View
          style={[
            styles.bottomSheet,
            { backgroundColor: theme.colors.surface },
            theme.shadows.card,
            { transform: [{ translateY: sheetTranslate }] },
          ]}
        >
          <View style={styles.sheetHandleWrap}>
            <View style={[styles.sheetHandle, { backgroundColor: theme.colors.border }]} />
          </View>

          <View style={styles.sheetHeader}>
            <View style={styles.sheetHeadingColumn}>
              <Text style={[styles.stateName, { color: theme.colors.text.primary }]}>
                {selectedState.name}
              </Text>
              <Text style={[styles.metricValue, { color: theme.colors.primary }]}>
                {formatMetricValue(metricKey, selectedValue)}
              </Text>
            </View>
            <TouchableOpacity
              accessibilityLabel="Close"
              onPress={() => setSelectedFips(null)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.sheetClose, { color: theme.colors.text.muted }]}>×</Text>
            </TouchableOpacity>
          </View>

          {selectedTopCareers.length === 0 ? (
            <Text style={[styles.noCareers, { color: theme.colors.text.secondary }]}>
              No career data available for this state.
            </Text>
          ) : (
            selectedTopCareers.map((career, index) => (
              <View key={`${career.id}-${index}`} style={styles.careerRow}>
                <Image source={{ uri: getImageUrl(career.occupation_code) }} style={styles.careerThumb} />
                <View style={styles.careerInfo}>
                  <Text numberOfLines={1} style={[styles.careerName, { color: theme.colors.text.primary }]}>
                    {career.occupation_name}
                  </Text>
                  <Text style={[styles.careerSalary, { color: theme.colors.text.secondary }]}>
                    ${Math.round(Number(career.annual_median_salary) || 0).toLocaleString('en-US')}/yr median
                  </Text>
                </View>
                <View style={[styles.roiChip, { backgroundColor: theme.colors.primaryLight }]}>
                  <Text style={[styles.roiChipText, { color: theme.colors.primaryDark }]}>
                    ROI {Math.round(Number(career.roi_percentage) || 0)}%
                  </Text>
                </View>
              </View>
            ))
          )}

          <Button
            title={`Explore ${selectedState.name} in Discover`}
            onPress={handleExplore}
            style={styles.exploreButton}
          />
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  } as ViewStyle,
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  } as ViewStyle,
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  } as ViewStyle,
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  } as ViewStyle,
  mapCard: {
    borderRadius: 16,
    overflow: 'hidden',
  } as ViewStyle,
  mapSvg: {
    aspectRatio: US_MAP_VIEWBOX.width / US_MAP_VIEWBOX.height,
    width: '100%',
  } as ViewStyle,
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
  } as ViewStyle,
  legendTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginRight: 12,
  } as TextStyle,
  legendBarWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  } as ViewStyle,
  legendBar: {
    flex: 1,
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    borderWidth: 1,
  } as ViewStyle,
  legendSegment: {
    flex: 1,
  } as ViewStyle,
  legendLabel: {
    fontSize: 12,
    marginHorizontal: 6,
  } as TextStyle,
  sourceNote: {
    fontSize: 11,
    marginTop: 10,
  } as TextStyle,
  skeletonMap: {
    borderRadius: 16,
    margin: 16,
    aspectRatio: US_MAP_VIEWBOX.width / US_MAP_VIEWBOX.height,
  } as ViewStyle,
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  loadingText: {
    marginTop: 12,
    fontSize: 15,
  } as TextStyle,
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  } as TextStyle,
  retryButton: {
    alignSelf: 'stretch',
  } as ViewStyle,
  bottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 20,
    maxHeight: 480,
  } as ViewStyle,
  sheetHandleWrap: {
    alignItems: 'center',
    marginBottom: 10,
  } as ViewStyle,
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  } as ViewStyle,
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  } as ViewStyle,
  sheetHeadingColumn: {
    flex: 1,
  } as ViewStyle,
  sheetClose: {
    fontSize: 26,
    lineHeight: 30,
    paddingHorizontal: 4,
  } as TextStyle,
  stateName: {
    fontSize: 22,
    fontWeight: 'bold',
  } as TextStyle,
  metricValue: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  } as TextStyle,
  noCareers: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 16,
  } as TextStyle,
  careerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  } as ViewStyle,
  careerThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: 'rgba(128,128,128,0.2)',
    marginRight: 12,
  } as ImageStyle,
  careerInfo: {
    flex: 1,
    marginRight: 8,
  } as ViewStyle,
  careerName: {
    fontSize: 15,
    fontWeight: '600',
  } as TextStyle,
  careerSalary: {
    fontSize: 13,
    marginTop: 2,
  } as TextStyle,
  roiChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9999,
  } as ViewStyle,
  roiChipText: {
    fontSize: 12,
    fontWeight: '700',
  } as TextStyle,
  exploreButton: {
    marginTop: 12,
  } as ViewStyle,
});
