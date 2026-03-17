import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { colors, spacing, typography } from '../constants/theme';

interface InfoRowProps {
  label: string;
  value: string | number;
  valueColor?: string;
  highlight?: boolean;
}

export const InfoRow: React.FC<InfoRowProps> = ({ label, value, valueColor, highlight }) => {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text
        style={[
          styles.value,
          highlight && styles.valueHighlight,
          valueColor ? { color: valueColor } : null,
        ]}
      >
        {value}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  } as ViewStyle,
  label: {
    fontSize: typography.body.fontSize,
    color: colors.text.secondary,
  } as TextStyle,
  value: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.text.primary,
  } as TextStyle,
  valueHighlight: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
  } as TextStyle,
});
