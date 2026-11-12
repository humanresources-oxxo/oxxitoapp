// src/components/StepsHeader.tsx
// Top progress header — ported from PSteps in screens-proto.jsx + .ox-top/.ox-back/.ox-steps CSS.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Pressable } from './Pressable';
import { Icon } from './Icon';
import { colors, radii, fontFamily } from '../theme/tokens';

type StepsHeaderProps = {
  active: number; // 0-based
  // Login -> PIN (or create PIN) -> terms: three steps in every path.
  total?: number;
  onBack?: () => void;
};

export function StepsHeader({ active, onBack, total = 3 }: StepsHeaderProps) {
  return (
    <View style={styles.top}>
      <Pressable accessibilityRole="button" accessibilityLabel="Regresar" onPress={onBack} style={styles.back}>
        <Icon name="chevL" size={20} color={colors.ink} />
      </Pressable>
      <View style={styles.steps}>
        {Array.from({ length: total }, (_, i) => i).map((i) => (
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
      <Text style={styles.stepNum} accessibilityLabel={`Paso ${active + 1} de ${total}`}>
        {active + 1}/{total}
      </Text>
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
    width: 44,
    height: 44,
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
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    color: colors.ink3,
  },

});
