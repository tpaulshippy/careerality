import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Modal, StyleSheet, Text, TextStyle, TouchableOpacity, View, ViewStyle } from 'react-native';
import { useTheme } from '../hooks/useTheme';

interface LevelUpOverlayProps {
  level: number | null;
  onDismiss: () => void;
}

const CONFETTI_COLORS = ['#136399', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6', '#EC4899'];
const PIECE_COUNT = 22;

const rand = (min: number, max: number): number => min + Math.random() * (max - min);

export const LevelUpOverlay: React.FC<LevelUpOverlayProps> = ({ level, onDismiss }) => {
  const theme = useTheme();

  const pieces = useMemo(
    () =>
      Array.from({ length: PIECE_COUNT }, (_, i) => ({
        id: i,
        left: rand(2, 94),
        delay: rand(0, 500),
        duration: rand(1400, 2400),
        size: rand(7, 13),
        drift: rand(-40, 40),
        spin: rand(180, 720) * (Math.random() > 0.5 ? 1 : -1),
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      })),
    [level],
  );

  const animsRef = useRef<Animated.Value[]>([]);
  if (animsRef.current.length !== pieces.length) {
    animsRef.current = pieces.map(() => new Animated.Value(0));
  }

  useEffect(() => {
    if (level === null) return undefined;
    // Reset from the previous run so every celebration starts its full fall.
    animsRef.current.forEach((value) => value.setValue(0));
    const animations = pieces.map((piece, i) =>
      Animated.sequence([
        Animated.delay(piece.delay),
        Animated.timing(animsRef.current[i], {
          toValue: 1,
          duration: piece.duration,
          useNativeDriver: true,
        }),
      ]),
    );
    animations.forEach((animation) => animation.start());
    return () => animations.forEach((animation) => animation.stop());
  }, [level, pieces]);

  if (level === null) return null;

  return (
    <Modal transparent visible animationType="fade" statusBarTranslucent onRequestClose={onDismiss}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onDismiss}>
        {pieces.map((piece, i) => (
          <Animated.View
            key={piece.id}
            pointerEvents="none"
            style={[
              styles.piece,
              {
                left: `${piece.left}%` as `${number}%`,
                width: piece.size,
                height: piece.size * 0.55,
                backgroundColor: piece.color,
                transform: [
                  {
                    translateX: animsRef.current[i].interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, piece.drift],
                    }),
                  },
                  {
                    translateY: animsRef.current[i].interpolate({
                      inputRange: [0, 1],
                      outputRange: [-60, 900],
                    }),
                  },
                  {
                    rotate: animsRef.current[i].interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', `${piece.spin}deg`],
                    }),
                  },
                ],
                opacity: animsRef.current[i].interpolate({
                  inputRange: [0, 0.85, 1],
                  outputRange: [1, 1, 0],
                }),
              },
            ]}
          />
        ))}

        <Text style={styles.emoji}>🎉</Text>
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.levelLabel, { color: theme.colors.text.secondary }]}>LEVEL UP</Text>
          <Text style={[styles.levelNumber, { color: theme.colors.primary }]}>Level {level}</Text>
          <Text style={[styles.hint, { color: theme.colors.text.muted }]}>Tap anywhere to continue</Text>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(17, 24, 39, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    elevation: 100,
  } as ViewStyle,
  card: {
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 44,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  } as ViewStyle,
  emoji: {
    fontSize: 52,
    marginBottom: -26,
    zIndex: 101,
  } as TextStyle,
  levelLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 4,
  } as TextStyle,
  levelNumber: {
    fontSize: 32,
    fontWeight: 'bold',
  } as TextStyle,
  hint: {
    fontSize: 12,
    marginTop: 12,
  } as TextStyle,
  piece: {
    position: 'absolute',
    top: -30,
    borderRadius: 2,
  } as ViewStyle,
});
