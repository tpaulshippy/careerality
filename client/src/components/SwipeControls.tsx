import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { Button } from './Button';

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
        <Button
          title="Undo"
          onPress={onUndo}
          style={[styles.undoButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
        />
      )}
      <View style={styles.buttonsRow}>
        <Button
          title="Skip"
          onPress={onSkip}
          disabled={disabled}
          style={[styles.button, { backgroundColor: theme.colors.error }]}
        />
        <Button
          title="Like"
          onPress={onLike}
          disabled={disabled}
          style={[styles.button, { backgroundColor: theme.colors.success }]}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  } as ViewStyle,
  buttonsRow: {
    flexDirection: 'row',
    gap: 12,
  } as ViewStyle,
  button: {
    flex: 1,
  } as ViewStyle,
  undoButton: {
    marginBottom: 12,
    borderWidth: 1,
  } as ViewStyle,
});