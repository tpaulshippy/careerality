import React, { useState } from 'react';
import { 
  View, 
  Text, 
  Modal, 
  TouchableOpacity, 
  ScrollView,
  StyleSheet,
  ViewStyle,
  TextStyle,
  TouchableWithoutFeedback,
} from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { FilterChip } from './FilterChip';
import { LOCATION_OPTIONS, SALARY_RANGES } from '../constants/dataSources';

export interface FilterState {
  location: string;
  minSalary: string;
  maxSalary: string;
}

interface FilterSheetProps {
  visible: boolean;
  onClose: () => void;
  onApply: (filters: FilterState) => void;
  initialFilters?: FilterState;
}

const defaultFilters: FilterState = {
  location: '',
  minSalary: '',
  maxSalary: '',
};

export const FilterSheet: React.FC<FilterSheetProps> = ({
  visible,
  onClose,
  onApply,
  initialFilters,
}) => {
  const theme = useTheme();
  const [filters, setFilters] = useState<FilterState>(initialFilters || defaultFilters);

  const handleApply = () => {
    onApply(filters);
    onClose();
  };

  const handleReset = () => {
    setFilters(defaultFilters);
    onApply(defaultFilters);
    onClose();
  };

  const handleLocationSelect = (value: string) => {
    setFilters(prev => ({ ...prev, location: value === 'all' ? '' : value }));
  };

  const handleSalarySelect = (min: number, max: number) => {
    setFilters(prev => ({
      ...prev,
      minSalary: min === 0 ? '' : String(min),
      maxSalary: max === Infinity ? '' : String(max),
    }));
  };

  const isLocationSelected = (value: string) => {
    if (value === 'all') return filters.location === '';
    return filters.location === value;
  };

  const isSalarySelected = (min: number, max: number) => {
    const currentMin = filters.minSalary === '' ? 0 : parseInt(filters.minSalary, 10);
    const currentMax = filters.maxSalary === '' ? Infinity : parseInt(filters.maxSalary, 10);
    return currentMin === min && currentMax === max;
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
                    Location
                  </Text>
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipRow}
                  >
                    {LOCATION_OPTIONS.map((option) => (
                      <FilterChip
                        key={option.value}
                        label={option.label}
                        selected={isLocationSelected(option.value)}
                        onPress={() => handleLocationSelect(option.value)}
                      />
                    ))}
                  </ScrollView>
                </View>

                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: theme.colors.primary }]}>
                    Salary Range
                  </Text>
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipRow}
                  >
                    {SALARY_RANGES.map((range) => (
                      <FilterChip
                        key={range.label}
                        label={range.label}
                        selected={isSalarySelected(range.min, range.max)}
                        onPress={() => handleSalarySelect(range.min, range.max)}
                      />
                    ))}
                  </ScrollView>
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
