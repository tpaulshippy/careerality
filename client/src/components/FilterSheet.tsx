import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  Modal, 
  TouchableOpacity, 
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  TouchableWithoutFeedback,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import RangeSlider from 'react-native-range-slider';
import { useTheme } from '../hooks/useTheme';

export interface FilterState {
  stateCode: string;
  minSalary: number;
  maxSalary: number;
}

interface FilterSheetProps {
  visible: boolean;
  onClose: () => void;
  onApply: (filters: FilterState) => void;
  initialFilters?: FilterState;
}

const defaultFilters: FilterState = {
  stateCode: '99',
  minSalary: 0,
  maxSalary: 1000000,
};

export const FilterSheet: React.FC<FilterSheetProps> = ({
  visible,
  onClose,
  onApply,
  initialFilters,
}) => {
  const theme = useTheme();
  const [filters, setFilters] = useState<FilterState>(initialFilters || defaultFilters);
  const [states, setStates] = useState<{ area_code: string; area_name: string }[]>([]);
  const [statesLoading, setStatesLoading] = useState(false);
  const [statesError, setStatesError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStates = async () => {
      setStatesLoading(true);
      setStatesError(null);
      try {
        const response = await fetch('/api/areas/states');
        if (!response.ok) throw new Error('Failed to fetch states');
        const data = await response.json();
        setStates(data.states || []);
      } catch (err) {
        setStatesError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setStatesLoading(false);
      }
    };
    fetchStates();
  }, []);

  const handleApply = () => {
    onApply(filters);
    onClose();
  };

  const handleReset = () => {
    setFilters(defaultFilters);
    onApply(defaultFilters);
    onClose();
  };

  const updateStateCode = (stateCode: string) => {
    setFilters(prev => ({ ...prev, stateCode }));
  };

  const handleSalaryChange = (selectedMin: number, selectedMax: number) => {
    setFilters(prev => ({ ...prev, minSalary: selectedMin, maxSalary: selectedMax }));
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[
              styles.sheet,
              { backgroundColor: theme.colors.surface }
            ]}>
              <View style={styles.handle} />
              
              <View style={styles.header}>
                <Text style={[styles.title, { color: theme.colors.text.primary }]}>
                  Filters
                </Text>
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Text style={[styles.closeButton, { color: theme.colors.text.muted }]}>
                    ×
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.content}>
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: theme.colors.primary }]}>
                    State Code
                  </Text>
                  {statesLoading ? (
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                  ) : statesError ? (
                    <Text style={{ color: theme.colors.text.muted }}>{statesError}</Text>
                  ) : (
                    <Picker
                      selectedValue={filters.stateCode}
                      onValueChange={(value) => updateStateCode(value as string)}
                      style={[
                        styles.input,
                        { 
                          backgroundColor: theme.colors.background,
                          color: theme.colors.text.primary,
                          borderColor: theme.colors.border,
                        }
                      ]}
                    >
                      <Picker.Item label="National" value="99" />
                      {states.map((state) => (
                        <Picker.Item
                          key={state.area_code}
                          label={state.area_name}
                          value={state.area_code}
                        />
                      ))}
                    </Picker>
                  )}
                </View>

                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: theme.colors.primary }]}>
                    Salary Range
                  </Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={[styles.inputLabel, { color: theme.colors.text.secondary }]}>
                      ${filters.minSalary.toLocaleString()}
                    </Text>
                    <Text style={[styles.inputLabel, { color: theme.colors.text.secondary }]}>
                      ${filters.maxSalary.toLocaleString()}
                    </Text>
                  </View>
                  <RangeSlider
                    minValue={0}
                    maxValue={1000000}
                    step={1000}
                    selectedMinimum={filters.minSalary}
                    selectedMaximum={filters.maxSalary}
                    onChange={(data: { selectedMinimum: number; selectedMaximum: number }) => {
                      if (data && typeof data === 'object') {
                        handleSalaryChange(data.selectedMinimum, data.selectedMaximum);
                      }
                    }}
                    style={{ height: 70, padding: 10, backgroundColor: theme.colors.background }}
                    tintColor={theme.colors.primary}
                    handleBorderColor={theme.colors.border}
                    handleBorderWidth={1}
                  />
                </View>
              </View>

              <View style={styles.footer}>
                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.resetButton,
                    { borderColor: theme.colors.border }
                  ]}
                  onPress={handleReset}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.buttonText, { color: theme.colors.text.secondary }]}>
                    Reset
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.applyButton,
                    { backgroundColor: theme.colors.primary }
                  ]}
                  onPress={handleApply}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>
                    Apply Filters
                  </Text>
                </TouchableOpacity>
              </View>
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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingBottom: 34,
    paddingHorizontal: 20,
    maxHeight: '80%',
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
    marginBottom: 24,
  } as ViewStyle,
  title: {
    fontSize: 20,
    fontWeight: '600',
  } as TextStyle,
  closeButton: {
    fontSize: 28,
    lineHeight: 28,
  } as TextStyle,
  content: {
    marginBottom: 24,
  } as ViewStyle,
  section: {
    marginBottom: 24,
  } as ViewStyle,
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  } as TextStyle,
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
  } as ViewStyle,
  footer: {
    flexDirection: 'row',
    gap: 12,
  } as ViewStyle,
  button: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  } as ViewStyle,
  resetButton: {
    borderWidth: 1,
  } as ViewStyle,
  applyButton: {} as ViewStyle,
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
  } as TextStyle,
});
