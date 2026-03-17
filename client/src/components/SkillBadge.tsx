import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { useTheme } from '../hooks/useTheme';

interface SkillBadgeProps {
  skill: string;
}

export const SkillBadge: React.FC<SkillBadgeProps> = ({ skill }) => {
  const theme = useTheme();
  
  return (
    <View style={[styles.badge, { backgroundColor: theme.colors.primaryLight }]}>
      <Text style={[styles.text, { color: theme.colors.primary }]}>{skill}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 9999,
  } as ViewStyle,
  text: {
    fontSize: 13,
    fontWeight: '500',
  } as TextStyle,
});
