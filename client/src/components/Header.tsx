import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { useTheme } from '../hooks/useTheme';

interface HeaderProps {
  title: string;
  subtitle?: string;
  style?: ViewStyle;
}

export const Header: React.FC<HeaderProps> = ({ title, subtitle, style }) => {
  const theme = useTheme();
  
  return (
    <View style={[styles.header, { backgroundColor: theme.colors.primary }, style]}>
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={[styles.subtitle, { color: theme.colors.text.light }]}>{subtitle}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    paddingTop: 54,
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  } as ViewStyle,
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
  } as TextStyle,
  subtitle: {
    fontSize: 16,
    marginTop: 4,
  } as TextStyle,
});
