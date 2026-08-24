import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ImageStyle,
  TextInput,
  TouchableOpacity,
  Image,
  Animated,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { CareerROI } from '../types';
import { apiClient } from '../api/client';
import { CareerDetailView, Button } from '../components';
import { useTheme, Theme } from '../hooks/useTheme';
import { useFilters } from '../hooks/useFilters';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { formatCurrency, formatPercent } from '../hooks/useFormatters';
import { getImageUrl } from '../utils/careerImage';
import {
  addRecentSearch,
  removeRecentSearch,
  loadSearchHistory,
  saveSearchHistory,
  clearSearchHistory,
  sanitizeQuery,
} from '../utils/searchHistory';

const MIN_QUERY_LENGTH = 2;
const SKELETON_ROWS = 5;

const CareerResultRow: React.FC<{
  career: CareerROI;
  onPress: (career: CareerROI) => void;
}> = ({ career, onPress }) => {
  const theme = useTheme();
  const [imageFailed, setImageFailed] = useState(false);
  const initial = career.occupation_name.charAt(0).toUpperCase();

  return (
    <TouchableOpacity
      style={[styles.row, { backgroundColor: theme.colors.surface }, theme.shadows.subtle]}
      onPress={() => onPress(career)}
      activeOpacity={0.7}
    >
      {imageFailed ? (
        <View style={[styles.thumb, styles.thumbFallback, { backgroundColor: theme.colors.primaryLight }]}>
          <Text style={[styles.thumbFallbackText, { color: theme.colors.primary }]}>{initial}</Text>
        </View>
      ) : (
        <Image
          source={{ uri: getImageUrl(career.occupation_code) }}
          style={styles.thumb}
          onError={() => setImageFailed(true)}
        />
      )}
      <View style={styles.rowText}>
        <Text style={[styles.rowName, { color: theme.colors.text.primary }]} numberOfLines={1}>
          {career.occupation_name}
        </Text>
        <Text style={[styles.rowSubtitle, { color: theme.colors.text.secondary }]}>
          {formatCurrency(career.annual_median_salary)} median salary
        </Text>
      </View>
      <View style={styles.rowChips}>
        <View style={[styles.chip, { backgroundColor: theme.colors.primaryLight }]}>
          <Text style={[styles.chipText, { color: theme.colors.primary }]}>
            {formatPercent(career.roi_percentage)} ROI
          </Text>
        </View>
        {career.demand_rank != null && (
          <View style={styles.demandChip}>
            <Text style={styles.demandChipText}>{`🔥 #${career.demand_rank}`}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

export const SearchScreen: React.FC = () => {
  const theme: Theme = useTheme();
  const { filters, setStateCode } = useFilters();
  const inputRef = useRef<TextInput>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [query, setQuery] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const debouncedQuery = useDebouncedValue(sanitizeQuery(query), 250);
  const [results, setResults] = useState<CareerROI[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [popular, setPopular] = useState<CareerROI[]>([]);
  const [popularLoading, setPopularLoading] = useState(true);
  const [states, setStates] = useState<{ area_code: string; area_name: string }[]>([]);
  const [statesError, setStatesError] = useState<string | null>(null);
  const [detailCareer, setDetailCareer] = useState<CareerROI | null>(null);

  const pulseAnim = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    let cancelled = false;
    apiClient.get<{ states: { area_code: string; area_name: string }[] }>('/api/areas/states')
      .then(json => {
        if (!cancelled) setStates(json.states || []);
      })
      .catch(() => {
        if (!cancelled) setStatesError('Could not load states');
      });
    return () => { cancelled = true; };
  }, []);

  // Pin the national option (area_code "99") first instead of leaving "U.S."
  // sorted alphabetically between Texas and Utah.
  const national = states.find(s => s.area_code === '99');
  const orderedStates = national
    ? [{ ...national, area_name: 'National (all states)' }, ...states.filter(s => s.area_code !== '99')]
    : states;

  useEffect(() => {
    let cancelled = false;
    loadSearchHistory().then(history => {
      if (!cancelled) setRecent(history);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setPopularLoading(true);
    apiClient.getCareers({ page: 1, sort: 'demand', area_code: filters.stateCode })
      .then(json => {
        if (!cancelled) setPopular(json.records || []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setPopularLoading(false);
      });
    return () => { cancelled = true; };
  }, [filters.stateCode]);

  const runSearch = useCallback(async (q: string, area: string, signal: AbortSignal) => {
    try {
      const json = await apiClient.searchCareers(q, area, signal);
      if (signal.aborted) return;
      setResults(json.records || []);
      setError(null);
    } catch {
      if (signal.aborted) return;
      setResults([]);
      setError('Something went wrong');
    } finally {
      if (!signal.aborted) setIsSearching(false);
    }
  }, []);

  const startSearch = useCallback((rawQuery: string) => {
    const q = sanitizeQuery(rawQuery);
    abortRef.current?.abort();
    if (q.length < MIN_QUERY_LENGTH) {
      setResults(null);
      setError(null);
      setIsSearching(false);
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setIsSearching(true);
    setError(null);
    runSearch(q, filters.stateCode, controller.signal);
  }, [runSearch, filters.stateCode]);

  useEffect(() => {
    startSearch(debouncedQuery);
    return () => {
      abortRef.current?.abort();
    };
  }, [debouncedQuery, startSearch]);

  useEffect(() => {
    if (!isSearching) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.45, duration: 650, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isSearching, pulseAnim]);

  const handleSubmit = useCallback(() => {
    inputRef.current?.blur();
    startSearch(query);
  }, [query, startSearch]);

  const handleClear = useCallback(() => {
    setQuery('');
    setResults(null);
    setError(null);
    setIsSearching(false);
    inputRef.current?.focus();
  }, []);

  const handleResultPress = useCallback((career: CareerROI) => {
    const q = sanitizeQuery(query);
    if (q.length >= MIN_QUERY_LENGTH) {
      setRecent(prev => {
        const next = addRecentSearch(prev, q);
        saveSearchHistory(next);
        return next;
      });
    }
    setDetailCareer(career);
  }, [query]);

  const handleRecentPress = useCallback((term: string) => {
    setQuery(term);
  }, []);

  const handleRecentRemove = useCallback((term: string) => {
    setRecent(prev => {
      const next = removeRecentSearch(prev, term);
      saveSearchHistory(next);
      return next;
    });
  }, []);

  const handleClearAll = useCallback(() => {
    clearSearchHistory();
    setRecent([]);
  }, []);

  if (detailCareer) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <CareerDetailView career={detailCareer} onClose={() => setDetailCareer(null)} />
      </View>
    );
  }

  const trimmed = sanitizeQuery(query);
  const hasQuery = trimmed.length > 0;
  const showResults = results !== null && !error && !isSearching && trimmed.length >= MIN_QUERY_LENGTH;
  const showRecents = isInputFocused && trimmed.length === 0 && recent.length > 0;
  const showPopular = !hasQuery && !showRecents;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.searchBarWrap}>
        <View style={[styles.searchBar, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.searchIcon, { color: theme.colors.text.muted }]}>🔎</Text>
          <TextInput
            ref={inputRef}
            style={[styles.input, { color: theme.colors.text.primary }]}
            placeholder="Search careers…"
            placeholderTextColor={theme.colors.text.muted}
            value={query}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            onChangeText={setQuery}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setIsInputFocused(false)}
            onSubmitEditing={handleSubmit}
          />
          {hasQuery && (
            <TouchableOpacity onPress={handleClear} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={[styles.clearButton, { color: theme.colors.text.muted }]}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.stateRow}>
        <Text style={[styles.stateIcon, { color: theme.colors.text.muted }]}>📍</Text>
        {statesError ? (
          <Text style={[styles.stateError, { color: theme.colors.text.muted }]}>{statesError}</Text>
        ) : (
          <View
            style={[
              styles.pickerWrap,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
            ]}
          >
            <Picker
              selectedValue={filters.stateCode}
              onValueChange={(value) => setStateCode(value as string)}
              style={{ color: theme.colors.text.primary }}
              enabled={states.length > 0}
            >
              {orderedStates.map((state) => (
                <Picker.Item
                  key={state.area_code}
                  label={state.area_name}
                  value={state.area_code}
                />
              ))}
            </Picker>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
        {error ? (
          <View style={[styles.stateCard, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.stateTitle, { color: theme.colors.error }]}>{error}</Text>
            <Text style={[styles.stateSubtitle, { color: theme.colors.text.secondary }]}>
              We couldn&apos;t reach the search service. Check your connection and try again.
            </Text>
            <Button title="Retry" onPress={handleSubmit} style={styles.retryButton} />
          </View>
        ) : isSearching ? (
          <>
            {[...Array(SKELETON_ROWS)].map((_, index) => (
              <Animated.View
                key={index}
                style={[
                  styles.row,
                  styles.skeletonRow,
                  { backgroundColor: theme.colors.surface, opacity: pulseAnim },
                ]}
              >
                <Animated.View style={[styles.thumb, { backgroundColor: theme.colors.border, opacity: pulseAnim }]} />
                <View style={styles.skeletonLines}>
                  <Animated.View style={[styles.skeletonLine, { backgroundColor: theme.colors.border, opacity: pulseAnim }]} />
                  <Animated.View style={[styles.skeletonLineShort, { backgroundColor: theme.colors.border, opacity: pulseAnim }]} />
                </View>
              </Animated.View>
            ))}
          </>
        ) : showResults && results!.length === 0 ? (
          <View style={[styles.stateCard, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.stateEmoji]}>🔍</Text>
            <Text style={[styles.stateTitle, { color: theme.colors.text.primary }]}>
              No matches for “{trimmed}”
            </Text>
            <Text style={[styles.stateSubtitle, { color: theme.colors.text.secondary }]}>
              Check the spelling or try a broader term like “nurse” or “engineer”.
            </Text>
          </View>
        ) : showRecents ? (
          <View>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text.secondary }]}>Recent searches</Text>
              <TouchableOpacity onPress={handleClearAll} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={[styles.clearAllText, { color: theme.colors.primary }]}>Clear all</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.chipWrap}>
              {recent.map(term => (
                <View key={term.toLowerCase()} style={[styles.recentChip, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                  <TouchableOpacity onPress={() => handleRecentPress(term)} activeOpacity={0.7}>
                    <Text style={[styles.recentChipText, { color: theme.colors.text.primary }]}>{term}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleRecentRemove(term)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}>
                    <Text style={[styles.recentChipRemove, { color: theme.colors.text.muted }]}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        ) : showPopular ? (
          <View>
            <Text style={[styles.sectionTitle, styles.popularTitle, { color: theme.colors.text.secondary }]}>
              Popular right now
            </Text>
            {popularLoading ? (
              <>
                {[...Array(Math.min(3, SKELETON_ROWS))].map((_, index) => (
                  <Animated.View
                    key={index}
                    style={[styles.row, { backgroundColor: theme.colors.surface, opacity: pulseAnim }]}
                  >
                    <Animated.View style={[styles.thumb, { backgroundColor: theme.colors.border, opacity: pulseAnim }]} />
                    <View style={styles.skeletonLines}>
                      <Animated.View style={[styles.skeletonLine, { backgroundColor: theme.colors.border, opacity: pulseAnim }]} />
                      <Animated.View style={[styles.skeletonLineShort, { backgroundColor: theme.colors.border, opacity: pulseAnim }]} />
                    </View>
                  </Animated.View>
                ))}
              </>
            ) : (
              popular.map(career => (
                <CareerResultRow key={career.id} career={career} onPress={setDetailCareer} />
              ))
            )}
          </View>
        ) : showResults ? (
          results!.map(career => (
            <CareerResultRow key={career.id} career={career} onPress={handleResultPress} />
          ))
        ) : null}
      </ScrollView>
    </View>
  );
};

interface Styles {
  container: ViewStyle;
  searchBarWrap: ViewStyle;
  searchBar: ViewStyle;
  searchIcon: TextStyle;
  input: TextStyle;
  clearButton: TextStyle;
  stateRow: ViewStyle;
  stateIcon: TextStyle;
  stateError: TextStyle;
  pickerWrap: ViewStyle;
  list: ViewStyle;
  row: ViewStyle;
  thumb: ImageStyle;
  thumbFallback: ViewStyle;
  thumbFallbackText: TextStyle;
  rowText: ViewStyle;
  rowName: TextStyle;
  rowSubtitle: TextStyle;
  rowChips: ViewStyle;
  chip: ViewStyle;
  chipText: TextStyle;
  demandChip: ViewStyle;
  demandChipText: TextStyle;

  stateCard: ViewStyle;
  stateEmoji: TextStyle;
  stateTitle: TextStyle;
  stateSubtitle: TextStyle;
  retryButton: ViewStyle;
  sectionHeader: ViewStyle;
  sectionTitle: TextStyle;
  popularTitle: TextStyle;
  clearAllText: TextStyle;
  chipWrap: ViewStyle;
  recentChip: ViewStyle;
  recentChipText: TextStyle;
  recentChipRemove: TextStyle;
  hint: TextStyle;
  skeletonRow: ViewStyle;
  skeletonLines: ViewStyle;
  skeletonLine: ViewStyle;
  skeletonLineShort: ViewStyle;
}

const styles = StyleSheet.create<Styles>({
  container: {
    flex: 1,
  },
  searchBarWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    fontSize: 15,
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 0,
  },
  clearButton: {
    fontSize: 16,
    fontWeight: '600',
    paddingLeft: 8,
  },
  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  stateIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  stateError: {
    fontSize: 13,
    flex: 1,
  },
  pickerWrap: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    height: 44,
    justifyContent: 'center',
  },
  list: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 10,
  },
  thumbFallback: {
    width: 48,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbFallbackText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  rowText: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  rowName: {
    fontSize: 15,
    fontWeight: '600',
  },
  rowSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  rowChips: {
    alignItems: 'flex-end',
    gap: 4,
  },
  chip: {
    borderRadius: 9999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  demandChip: {
    marginTop: 2,
  },
  demandChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  stateCard: {
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    marginTop: 12,
  },
  stateEmoji: {
    fontSize: 32,
    marginBottom: 12,
  },
  stateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  stateSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    alignSelf: 'stretch',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  popularTitle: {
    marginTop: 4,
    marginBottom: 10,
  },
  clearAllText: {
    fontSize: 13,
    fontWeight: '600',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  recentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 9999,
    borderWidth: 1,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 6,
  },
  recentChipText: {
    fontSize: 13,
  },
  recentChipRemove: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  hint: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 24,
  },
  skeletonRow: {
    minHeight: 72,
  },
  skeletonLines: {
    flex: 1,
    marginLeft: 12,
  },
  skeletonLine: {
    height: 14,
    borderRadius: 7,
    width: '70%',
  },
  skeletonLineShort: {
    height: 11,
    borderRadius: 6,
    width: '45%',
    marginTop: 8,
  },
});
