import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { useTheme } from '../hooks/useTheme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  style?: ViewStyle;
}

export const Button: React.FC<ButtonProps> = ({ title, onPress, style }) => {
  const theme = useTheme();
  
  return (
    <TouchableOpacity 
      style={[styles.button, { backgroundColor: theme.colors.primary }, style]} 
      onPress={onPress} 
      activeOpacity={0.8}
    >
      <Text style={styles.buttonText}>{title}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  } as ViewStyle,
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  } as TextStyle,
});
