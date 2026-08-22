import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ImageStyle,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect, useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import { CareerROI } from '../types';
import { apiClient } from '../api/client';
import { CareerDetailView } from '../components/CareerDetailView';
import { Button } from '../components/Button';
import { useTheme } from '../hooks/useTheme';
import { formatCurrency } from '../hooks/useFormatters';
import { getOccupationGroup } from '../utils/occupationGroup';
import { getImageUrl } from '../utils/careerImage';
import { buildCompareRows, barFractions, orderCareersByIds } from '../utils/compare';

interface LikedRecord extends CareerROI {
  swipe_id: number;
  swiped_at: string;
}

type CompareRouteParams = { ids?: number[] };

interface BarFillProps {
  fraction: number;
  maxWidth: number;
  color: string;
}

const BarFill: React.FC<BarFillProps> = ({ fraction, maxWidth, color }) => {
  const width = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    width.setValue(0);
    const animation = Animated.timing(width, {
      toValue: Math.round(fraction * maxWidth),
      duration: 450,
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [fraction, maxWidth, width]);

  return (
    <Animated.View
      style={[styles.barFill, { backgroundColor: color, width }]}
      testID="compare-bar-fill"
    />
  );
};

export const CompareScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation<{ navigate: (name: string, params?: object) => void }>();
  const route = useRoute<RouteProp<{ Compare: CompareRouteParams }, 'Compare'>>();
  const { width: windowWidth } = useWindowDimensions();
  const [ids, setIds] = useState<number[]>(route.params?.ids ?? []);
  const [likedRecords, setLikedRecords] = useState<LikedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailCareer, setDetailCareer] = useState<CareerROI | null>(null);
  const [failedThumbs, setFailedThumbs] = useState<number[]>([]);

  const fetchLiked = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const json = await apiClient.getLikedCareers() as { records: LikedRecord[] };
      setLikedRecords(json.records || []);
    } catch {
      setError('Failed to load comparison');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchLiked();
    }, [fetchLiked])
  );

  const careers = useMemo(() => orderCareersByIds(likedRecords, ids), [likedRecords, ids]);
  const rows = useMemo(() => buildCompareRows(careers), [careers]);

  const handleRemove = useCallback((id: number) => {
    setIds(prev => prev.filter(selected => selected !== id));
  }, []);

  const markThumbFailed = useCallback((id: number) => {
    setFailedThumbs(prev => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.text.secondary }]}>
          Loading comparison...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
        <Text style={[styles.retryText, { color: theme.colors.primary }]} onPress={fetchLiked}>
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

  if (careers.length === 0) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <Text style={styles.emptyIcon}>⚖️</Text>
        <Text style={[styles.emptyTitle, { color: theme.colors.text.primary }]}>
          Nothing to compare yet
        </Text>
        <Text style={[styles.emptySubtitle, { color: theme.colors.text.secondary }]}>
          Pick two to four liked careers and see how they stack up on salary, ROI, break-even time
          and demand.
        </Text>
        <Button title="Go to Liked" onPress={() => navigation.navigate('Liked')} />
      </View>
    );
  }

  const gap = 10;
  const edgePadding = 16;
  const labelWidth = 116;
  const available = windowWidth - edgePadding * 2;
  const columnWidth =
    careers.length === 1 ? available : careers.length === 2 ? Math.floor((available - gap) / 2) : 148;

  const infoRows = [
    { label: 'Education', values: careers.map(c => c.education_level || '—') },
    { label: 'Education Cost', values: careers.map(c => formatCurrency(c.education_cost)) },
    { label: 'Field', values: careers.map(c => getOccupationGroup(c.occupation_code)) },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.countCaption, { color: theme.colors.text.secondary }]}>
          Comparing {careers.length} {careers.length === 1 ? 'career' : 'careers'}
        </Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.table}>
          <View>
            <View style={[styles.headerRow, { gap }]}>
              <View style={{ width: labelWidth, marginRight: gap }} />
              {careers.map((career, index) => {
                const thumbFailed = failedThumbs.includes(career.id);
                return (
                  <View key={career.id} style={{ width: columnWidth }}>
                    <TouchableOpacity
                      style={[styles.headerCard, { backgroundColor: theme.colors.surface }, theme.shadows.subtle]}
                      onPress={() => setDetailCareer(career)}
                      activeOpacity={0.7}
                      testID={`compare-header-${index}`}
                    >
                      <TouchableOpacity
                        style={[styles.removeButton, { backgroundColor: theme.colors.border }]}
                        onPress={() => handleRemove(career.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        testID={`compare-remove-${index}`}
                      >
                        <Text style={[styles.removeButtonText, { color: theme.colors.text.secondary }]}>✕</Text>
                      </TouchableOpacity>

                      <View
                        style={[
                          styles.thumb,
                          { backgroundColor: theme.colors.primaryLight },
                          thumbFailed && styles.thumbFallback,
                        ]}
                      >
                        {thumbFailed ? (
                          <Text style={[styles.thumbInitial, { color: theme.colors.primary }]}>
                            {career.occupation_name.charAt(0)}
                          </Text>
                        ) : (
                          <Image
                            source={{ uri: getImageUrl(career.occupation_code) }}
                            style={styles.thumbImage}
                            resizeMode="cover"
                            onError={() => markThumbFailed(career.id)}
                          />
                        )}
                      </View>

                      <Text style={[styles.careerName, { color: theme.colors.text.primary }]} numberOfLines={2}>
                        {career.occupation_name}
                      </Text>
                      <Text style={[styles.areaName, { color: theme.colors.text.secondary }]} numberOfLines={1}>
                        {career.area_name}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>

            {rows.map(row => {
              const fractions = barFractions(row.cells.map(cell => cell.value));
              return (
                <View key={row.key} style={styles.metricRow}>
                  <View style={[styles.labelBox, { width: labelWidth, marginRight: gap }]}>
                    <Text style={[styles.labelText, { color: theme.colors.text.secondary }]}>{row.label}</Text>
                  </View>
                  <View style={[styles.cellsRow, { gap }]}>
                    {row.cells.map((cell, cellIndex) => {
                      const isBest = row.bestIndex === cellIndex;
                      const isWorst = row.worstIndex === cellIndex;
                      return (
                        <View
                          key={`${row.key}-${careers[cellIndex]?.id ?? cellIndex}`}
                          style={[
                            styles.metricCell,
                            { width: columnWidth },
                            isBest && {
                              borderColor: theme.colors.primary,
                              backgroundColor: theme.colors.primaryLight,
                            },
                          ]}
                          testID={`compare-cell-${row.key}-${cellIndex}`}
                        >
                          <View style={isWorst ? styles.dimmed : undefined}>
                            <View style={styles.valueRow}>
                              <Text style={[styles.valueText, { color: theme.colors.text.primary }]} numberOfLines={1}>
                                {cell.display}
                              </Text>
                              {isBest && (
                                <View style={[styles.bestChip, { backgroundColor: theme.colors.primary }]}>
                                  <Text style={styles.bestChipText}>✓ Best</Text>
                                </View>
                              )}
                            </View>
                            {cell.value !== null && (
                              <View style={[styles.track, { backgroundColor: theme.colors.border }]}>
                                <BarFill
                                  fraction={fractions[cellIndex]}
                                  maxWidth={columnWidth - 20}
                                  color={theme.colors.primary}
                                />
                              </View>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              );
            })}

            <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

            {infoRows.map(infoRow => (
              <View key={infoRow.label} style={styles.metricRow}>
                <View style={[styles.labelBox, { width: labelWidth, marginRight: gap }]}>
                  <Text style={[styles.labelText, { color: theme.colors.text.secondary }]}>{infoRow.label}</Text>
                </View>
                <View style={[styles.cellsRow, { gap }]}>
                  {infoRow.values.map((value, cellIndex) => (
                    <View
                      key={`${infoRow.label}-${careers[cellIndex]?.id ?? cellIndex}`}
                      style={[styles.infoCell, { width: columnWidth }]}
                    >
                      <Text style={[styles.infoText, { color: theme.colors.text.primary }]} numberOfLines={2}>
                        {value}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  } as ViewStyle,
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  } as ViewStyle,
  loadingText: {
    marginTop: 16,
    fontSize: 15,
  } as TextStyle,
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 12,
  } as TextStyle,
  retryText: {
    fontSize: 16,
    fontWeight: '600',
  } as TextStyle,
  emptyIcon: {
    fontSize: 44,
    marginBottom: 12,
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
    marginBottom: 24,
    lineHeight: 20,
  } as TextStyle,
  content: {
    paddingVertical: 16,
  } as ViewStyle,
  countCaption: {
    fontSize: 13,
    fontWeight: '600',
    marginHorizontal: 16,
    marginBottom: 12,
  } as TextStyle,
  table: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  } as ViewStyle,
  headerRow: {
    flexDirection: 'row',
    marginBottom: 16,
  } as ViewStyle,
  headerCard: {
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  } as ViewStyle,
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  } as ViewStyle,
  removeButtonText: {
    fontSize: 13,
    fontWeight: 'bold',
  } as TextStyle,
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  } as ViewStyle,
  thumbFallback: {
    overflow: 'visible',
  } as ViewStyle,
  thumbImage: {
    width: '100%',
    height: '100%',
  } as ImageStyle,
  thumbInitial: {
    fontSize: 26,
    fontWeight: 'bold',
  } as TextStyle,
  careerName: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    minHeight: 32,
  } as TextStyle,
  areaName: {
    fontSize: 11,
    marginTop: 2,
    maxWidth: '100%',
  } as TextStyle,
  metricRow: {
    flexDirection: 'row',
    marginBottom: 12,
  } as ViewStyle,
  labelBox: {
    justifyContent: 'center',
  } as ViewStyle,
  labelText: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  } as TextStyle,
  cellsRow: {
    flexDirection: 'row',
  } as ViewStyle,
  metricCell: {
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 9,
  } as ViewStyle,
  dimmed: {
    opacity: 0.45,
  } as ViewStyle,
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 4,
  } as ViewStyle,
  valueText: {
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 1,
  } as TextStyle,
  bestChip: {
    borderRadius: 9999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  } as ViewStyle,
  bestChipText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  } as TextStyle,
  track: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  } as ViewStyle,
  barFill: {
    height: '100%',
    borderRadius: 4,
  } as ViewStyle,
  divider: {
    height: 1,
    marginBottom: 14,
  } as ViewStyle,
  infoCell: {
    paddingVertical: 2,
  } as ViewStyle,
  infoText: {
    fontSize: 12,
    lineHeight: 16,
  } as TextStyle,
});
