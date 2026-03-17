import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../hooks/useTheme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export const Card: React.FC<CardProps> = ({ children, style }) => {
  const theme = useTheme();
  
  return (
    <View 
      style={[
        styles.card, 
        { backgroundColor: theme.colors.surface }, 
        theme.shadows.card,
        style
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    margin: 20,
    marginTop: -20,
    borderRadius: 16,
    padding: 20,
  } as ViewStyle,
});
