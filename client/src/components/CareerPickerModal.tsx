import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  StyleSheet,
  ViewStyle,
  TextStyle,
  TouchableWithoutFeedback,
} from 'react-native';
import { CareerROI } from '../types';
import { apiClient } from '../api/client';
import { useTheme } from '../hooks/useTheme';
import { formatCurrency } from '../hooks/useFormatters';

const SEARCH_DEBOUNCE_MS = 300;

interface CareerPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (career: CareerROI) => void;
}

export const CareerPickerModal: React.FC<CareerPickerModalProps> = ({
  visible,
  onClose,
  onSelect,
}) => {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CareerROI[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchKeyRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runFetch = useCallback(async (searching: boolean, q: string) => {
    const thisFetch = ++fetchKeyRef.current;
    setLoading(true);
    setError(null);
    try {
      const json = searching
        ? await apiClient.searchCareers(q)
        : await apiClient.getCareers({ page: 1, sort: 'demand', area_code: '99' });
      if (thisFetch !== fetchKeyRef.current) return;
      setResults(json.records || []);
    } catch {
      if (thisFetch === fetchKeyRef.current) {
        setError('Failed to load careers. Tap to retry.');
      }
    } finally {
      if (thisFetch === fetchKeyRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!visible) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      fetchKeyRef.current++;
      setLoading(false);
      setError(null);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      runFetch(false, '');
      return;
    }
    debounceRef.current = setTimeout(() => {
      runFetch(true, trimmed);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, visible, runFetch]);

  const retry = useCallback(() => {
    const trimmed = query.trim();
    runFetch(trimmed.length > 0, trimmed);
  }, [query, runFetch]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.sheet, { backgroundColor: theme.colors.surface }]}>
              <View style={styles.handle} />
              <View style={styles.header}>
                <Text style={[styles.title, { color: theme.colors.text.primary }]}>
                  Choose a career
                </Text>
                <TouchableOpacity
                  onPress={onClose}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={[styles.closeButton, { color: theme.colors.text.muted }]}>×</Text>
                </TouchableOpacity>
              </View>

              <TextInput
                style={[
                  styles.searchInput,
                  {
                    backgroundColor: theme.colors.background,
                    borderColor: theme.colors.border,
                    color: theme.colors.text.primary,
                  },
                ]}
                placeholder="Search careers (e.g. registered nurse)"
                placeholderTextColor={theme.colors.text.muted}
                value={query}
                onChangeText={setQuery}
                autoCorrect={false}
              />

              {error ? (
                <TouchableOpacity style={styles.stateBox} onPress={retry}>
                  <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
                </TouchableOpacity>
              ) : loading ? (
                <View style={styles.stateBox}>
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                </View>
              ) : results.length === 0 ? (
                <View style={styles.stateBox}>
                  <Text style={[styles.emptyText, { color: theme.colors.text.secondary }]}>
                    No careers match “{query.trim()}”
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={results}
                  keyExtractor={(item) => `${item.occupation_code}-${item.area_code}`}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[styles.resultRow, { borderBottomColor: theme.colors.border }]}
                      onPress={() => onSelect(item)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.resultText}>
                        <Text
                          style={[styles.resultName, { color: theme.colors.text.primary }]}
                          numberOfLines={1}
                        >
                          {item.occupation_name}
                        </Text>
                        <Text style={[styles.resultMeta, { color: theme.colors.text.secondary }]}>
                          {formatCurrency(item.annual_median_salary)} median ·{' '}
                          {item.years_to_breakeven}yr break-even
                        </Text>
                      </View>
                      <Text style={[styles.resultChevron, { color: theme.colors.primary }]}>›</Text>
                    </TouchableOpacity>
                  )}
                />
              )}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  } as ViewStyle,
  sheet: {
    height: '80%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingBottom: 24,
    paddingHorizontal: 20,
  } as ViewStyle,
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  } as ViewStyle,
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  } as ViewStyle,
  title: {
    fontSize: 20,
    fontWeight: '600',
  } as TextStyle,
  closeButton: {
    fontSize: 28,
    lineHeight: 28,
  } as TextStyle,
  searchInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 12,
  } as TextStyle,
  stateBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  } as ViewStyle,
  errorText: {
    fontSize: 15,
    textAlign: 'center',
  } as TextStyle,
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
  } as TextStyle,
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  } as ViewStyle,
  resultText: {
    flex: 1,
    marginRight: 8,
  } as ViewStyle,
  resultName: {
    fontSize: 16,
    fontWeight: '600',
  } as TextStyle,
  resultMeta: {
    fontSize: 13,
    marginTop: 2,
  } as TextStyle,
  resultChevron: {
    fontSize: 22,
    fontWeight: '600',
  } as TextStyle,
});
