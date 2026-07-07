// src/components/StepsHeader.tsx
// Top progress header — ported from PSteps in screens-proto.jsx + .ox-top/.ox-back/.ox-steps CSS.
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Icon } from './Icon';
import { colors, radii } from '../theme/tokens';

type StepsHeaderProps = {
  active: number; // 0-3
  onBack?: () => void;
};

export function StepsHeader({ active, onBack }: StepsHeaderProps) {
  return (
    <View style={styles.top}>
      <Pressable onPress={onBack} style={styles.back}>
        <Icon name="chevL" size={20} color={colors.ink} />
      </Pressable>
      <View style={styles.steps}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={[
              styles.step,
              i < active && styles.stepDone,
              i === active && styles.stepActive,
            ]}
          />
        ))}
      </View>
      <Text style={styles.stepNum}>{active + 1}/4</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 4,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
  },
  steps: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  step: {
    flex: 1,
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.line2,
  },
  stepDone: {
    backgroundColor: colors.oxOrange,
  },
  stepActive: {
    backgroundColor: colors.oxRed,
  },
  stepNum: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: colors.ink3,
  },
});
