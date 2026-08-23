import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, ViewStyle } from 'react-native';
import { XpPillData } from '../hooks/useGamification';

interface XpPillProps {
  gain: XpPillData | null;
  onDismiss: () => void;
}

export const XpPill: React.FC<XpPillProps> = ({ gain, onDismiss }) => {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!gain) return undefined;
    anim.setValue(0);
    const animation = Animated.sequence([
      Animated.timing(anim, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.back(2)),
        useNativeDriver: true,
      }),
      Animated.delay(800),
      Animated.timing(anim, {
        toValue: 0,
        duration: 280,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]);
    animation.start(({ finished }) => {
      if (finished) onDismiss();
    });
    return () => animation.stop();
  }, [gain, anim, onDismiss]);

  if (!gain) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.container,
        {
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [26, 0],
              }),
            },
            {
              scale: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.8, 1],
              }),
            },
          ],
        },
      ]}
    >
      <Text style={styles.text}>+{gain.amount} XP</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignSelf: 'center',
    top: '38%',
    zIndex: 20,
    backgroundColor: '#059669',
    borderRadius: 9999,
    paddingVertical: 8,
    paddingHorizontal: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
  } as ViewStyle,
  text: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
