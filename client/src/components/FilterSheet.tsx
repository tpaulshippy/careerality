import React, { useState } from 'react';
import { 
  View, 
  Text, 
  Modal, 
  TouchableOpacity, 
  TextInput,
  StyleSheet,
  ViewStyle,
  TextStyle,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTheme } from '../hooks/useTheme';

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

  const updateFilter = (key: keyof FilterState, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
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
            <KeyboardAvoidingView 
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={[
                styles.sheet,
                { backgroundColor: theme.colors.surface }
              ]}
            >
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
                  <TextInput
                    style={[
                      styles.input,
                      { 
                        backgroundColor: theme.colors.background,
                        color: theme.colors.text.primary,
                        borderColor: theme.colors.border,
                      }
                    ]}
                    placeholder="Enter city or remote"
                    placeholderTextColor={theme.colors.text.muted}
                    value={filters.location}
                    onChangeText={(text) => updateFilter('location', text)}
                  />
                </View>

                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: theme.colors.primary }]}>
                    Salary Range
                  </Text>
                  <View style={styles.salaryRow}>
                    <View style={styles.salaryInput}>
                      <Text style={[styles.inputLabel, { color: theme.colors.text.secondary }]}>
                        Min
                      </Text>
                      <TextInput
                        style={[
                          styles.input,
                          { 
                            backgroundColor: theme.colors.background,
                            color: theme.colors.text.primary,
                            borderColor: theme.colors.border,
                          }
                        ]}
                        placeholder="$0"
                        placeholderTextColor={theme.colors.text.muted}
                        value={filters.minSalary}
                        onChangeText={(text) => updateFilter('minSalary', text)}
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={styles.salaryDivider} />
                    <View style={styles.salaryInput}>
                      <Text style={[styles.inputLabel, { color: theme.colors.text.secondary }]}>
                        Max
                      </Text>
                      <TextInput
                        style={[
                          styles.input,
                          { 
                            backgroundColor: theme.colors.background,
                            color: theme.colors.text.primary,
                            borderColor: theme.colors.border,
                          }
                        ]}
                        placeholder="No limit"
                        placeholderTextColor={theme.colors.text.muted}
                        value={filters.maxSalary}
                        onChangeText={(text) => updateFilter('maxSalary', text)}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>
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
            </KeyboardAvoidingView>
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
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
  } as TextStyle,
  salaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  } as ViewStyle,
  salaryInput: {
    flex: 1,
  } as ViewStyle,
  salaryDivider: {
    width: 16,
  } as ViewStyle,
  inputLabel: {
    fontSize: 13,
    marginBottom: 6,
  } as TextStyle,
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
