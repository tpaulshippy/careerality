import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle, TouchableOpacity } from 'react-native';
import { useTheme } from '../hooks/useTheme';

interface SwipeControlsProps {
  onSkip: () => void;
  onLike: () => void;
  onUndo?: () => void;
  disabled?: boolean;
}

export const SwipeControls: React.FC<SwipeControlsProps> = ({ 
  onSkip, 
  onLike, 
  onUndo, 
  disabled 
}) => {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      {onUndo && (
        <TouchableOpacity
          style={[styles.undoButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
          onPress={onUndo}
          disabled={disabled}
        >
          <Text style={[styles.undoText, { color: theme.colors.text.primary }]}>Undo</Text>
        </TouchableOpacity>
      )}
      <View style={styles.iconRow}>
        <TouchableOpacity
          style={[styles.iconButton, styles.skipButton, { backgroundColor: theme.colors.error }]}
          onPress={onSkip}
          disabled={disabled}
          activeOpacity={0.8}
        >
          <Text style={styles.iconText}>✕</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.iconButton, styles.likeButton, { backgroundColor: theme.colors.success }]}
          onPress={onLike}
          disabled={disabled}
          activeOpacity={0.8}
        >
          <Text style={styles.iconText}>✓</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  } as ViewStyle,
  undoButton: {
    marginBottom: 12,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  } as ViewStyle,
  undoText: {
    fontSize: 15,
    fontWeight: '600',
  } as TextStyle,
  iconRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
  } as ViewStyle,
  iconButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  skipButton: {} as ViewStyle,
  likeButton: {} as ViewStyle,
  iconText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: 'bold',
  } as TextStyle,
});
