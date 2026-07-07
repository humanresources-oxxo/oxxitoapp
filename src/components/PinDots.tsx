// src/components/PinDots.tsx
// PIN dots — ported from pinDots() in screens-proto.jsx + .ox-pin CSS (incl. oxShake error animation).
import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { colors } from '../theme/tokens';

type PinDotsProps = {
  length: number;
  total?: number;
  error?: boolean;
};

export function PinDots({ length, total = 4, error = false }: PinDotsProps) {
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (error) {
      Animated.sequence([
        Animated.timing(shake, { toValue: -7, duration: 60, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 7, duration: 80, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -7, duration: 80, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: true }),
      ]).start();
    }
  }, [error, shake]);

  return (
    <Animated.View style={[styles.row, { transform: [{ translateX: shake }] }]}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i < length && (error ? styles.dotError : styles.dotOn),
          ]}
        />
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'center',
    paddingVertical: 8,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.line2,
  },
  dotOn: {
    backgroundColor: colors.oxRed,
  },
  dotError: {
    backgroundColor: colors.oxRed,
  },
});
