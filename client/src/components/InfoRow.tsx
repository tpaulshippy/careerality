import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { useTheme } from '../hooks/useTheme';

interface InfoRowProps {
  label: string;
  value: string | number;
  valueColor?: string;
  highlight?: boolean;
}

export const InfoRow: React.FC<InfoRowProps> = ({ label, value, valueColor, highlight }) => {
  const theme = useTheme();
  
  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: theme.colors.text.secondary }]}>{label}</Text>
      <Text
        style={[
          styles.value,
          highlight && { color: theme.colors.primary, fontSize: 18, fontWeight: 'bold' as const },
          valueColor ? { color: valueColor } : null,
          !highlight && !valueColor && { color: theme.colors.text.primary },
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
    marginBottom: 8,
  } as ViewStyle,
  label: {
    fontSize: 15,
  } as TextStyle,
  value: {
    fontSize: 15,
    fontWeight: '600',
  } as TextStyle,
});
