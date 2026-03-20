import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { useTheme } from '../hooks/useTheme';

interface FilterChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  onRemove?: () => void;
}

export const FilterChip: React.FC<FilterChipProps> = ({ 
  label, 
  selected = false, 
  onPress, 
  onRemove 
}) => {
  const theme = useTheme();
  
  return (
    <TouchableOpacity 
      style={[
        styles.chip,
        { 
          backgroundColor: selected ? theme.colors.primary : theme.colors.surface,
          borderColor: selected ? theme.colors.primary : theme.colors.border,
        },
        theme.shadows.subtle,
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text 
        style={[
          styles.label,
          { color: selected ? '#FFFFFF' : theme.colors.text.secondary }
        ]}
      >
        {label}
      </Text>
      {onRemove && (
        <TouchableOpacity 
          style={styles.removeButton}
          onPress={onRemove}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text 
            style={[
              styles.removeIcon,
              { color: selected ? '#FFFFFF' : theme.colors.text.muted }
            ]}
          >
            ×
          </Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9999,
    borderWidth: 1,
    marginRight: 8,
    marginBottom: 8,
  } as ViewStyle,
  label: {
    fontSize: 14,
    fontWeight: '500',
  } as TextStyle,
  removeButton: {
    marginLeft: 6,
  } as ViewStyle,
  removeIcon: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 18,
  } as TextStyle,
});
