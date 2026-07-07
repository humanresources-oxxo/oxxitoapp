// src/components/OxKeypad.tsx
// Numeric keypad — ported from OxKeypad in screens-proto.jsx + .ox-keys/.ox-key CSS.
import React, { useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { Icon } from './Icon';
import { colors, radii } from '../theme/tokens';

type OxKeypadProps = {
  onKey: (digit: string) => void;
  onDel: () => void;
};

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

function Key({ k, onKey, onDel }: { k: string; onKey: OxKeypadProps['onKey']; onDel: OxKeypadProps['onDel'] }) {
  const scale = useRef(new Animated.Value(1)).current;

  if (k === '') {
    return <View style={[styles.key, styles.blank]} />;
  }

  const pressIn = () => Animated.timing(scale, { toValue: 0.94, duration: 80, useNativeDriver: true }).start();
  const pressOut = () => Animated.timing(scale, { toValue: 1, duration: 120, useNativeDriver: true }).start();

  return (
    <Pressable
      onPress={() => (k === 'del' ? onDel() : onKey(k))}
      onPressIn={pressIn}
      onPressOut={pressOut}
      style={{ flex: 1 }}
    >
      <Animated.View style={[styles.key, { transform: [{ scale }] }]}>
        {k === 'del' ? (
          <Icon name="chevL" size={24} color={colors.ink2} />
        ) : (
          <Text style={styles.keyText}>{k}</Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

export function OxKeypad({ onKey, onDel }: OxKeypadProps) {
  const rows = [KEYS.slice(0, 3), KEYS.slice(3, 6), KEYS.slice(6, 9), KEYS.slice(9, 12)];
  return (
    <View style={styles.keys}>
      {rows.map((row, ri) => (
        <View key={ri} style={styles.row}>
          {row.map((k, ki) => (
            <Key key={ri * 3 + ki} k={k} onKey={onKey} onDel={onDel} />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  keys: {
    paddingHorizontal: 30,
    gap: 14,
  },
  row: {
    flexDirection: 'row',
    gap: 22,
  },
  key: {
    height: 62,
    borderRadius: radii.xl,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(36,26,23,1)',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  blank: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 0,
    elevation: 0,
  },
  keyText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 26,
    color: colors.ink,
  },
});
