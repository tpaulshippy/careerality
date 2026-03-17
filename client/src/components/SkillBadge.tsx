import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { colors, spacing, borderRadius } from '../constants/theme';

interface SkillBadgeProps {
  skill: string;
}

export const SkillBadge: React.FC<SkillBadgeProps> = ({ skill }) => {
  return (
    <View style={styles.badge}>
      <Text style={styles.text}>{skill}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm / 2,
    borderRadius: borderRadius.full,
  } as ViewStyle,
  text: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '500',
  } as TextStyle,
});
