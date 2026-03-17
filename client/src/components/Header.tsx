import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { colors, spacing, borderRadius, typography } from '../constants/theme';

interface HeaderProps {
  title: string;
  subtitle?: string;
  style?: ViewStyle;
}

export const Header: React.FC<HeaderProps> = ({ title, subtitle, style }) => {
  return (
    <View style={[styles.header, style]}>
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.primary,
    paddingTop: spacing.xxl + 30,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
    borderBottomLeftRadius: borderRadius.xl,
    borderBottomRightRadius: borderRadius.xl,
  } as ViewStyle,
  title: {
    fontSize: typography.title.fontSize,
    fontWeight: typography.title.fontWeight,
    color: '#FFFFFF',
  } as TextStyle,
  subtitle: {
    fontSize: typography.subtitle.fontSize,
    color: colors.text.light,
    marginTop: spacing.xs,
  } as TextStyle,
});
