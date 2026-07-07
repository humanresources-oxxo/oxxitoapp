// src/components/OxButton.tsx
// Buttons — ported from .ox-btn / .ox-btn.ghost / .ox-btn.light / .ox-btn.outline / .ox-btn.disabled
import React from 'react';
import { Pressable, Text, View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients, radii, type } from '../theme/tokens';

type Variant = 'primary' | 'ghost' | 'light' | 'outline';

type OxButtonProps = {
  children: React.ReactNode;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function OxButton({ children, onPress, variant = 'primary', disabled, icon, style }: OxButtonProps) {
  const isGhost = variant === 'ghost';

  if (variant === 'primary') {
    if (disabled) {
      return (
        <View style={[styles.base, styles.disabled, style]}>
          <Text style={[type.button, styles.textWhite]}>{children}</Text>
        </View>
      );
    }
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.pressed]}>
        <LinearGradient
          colors={gradients.oxGrad.colors}
          locations={gradients.oxGrad.locations}
          start={gradients.oxGrad.start}
          end={gradients.oxGrad.end}
          style={[styles.base, styles.shadowPrimary, style]}
        >
          <Text style={[type.button, styles.textWhite]}>{children}</Text>
          {icon}
        </LinearGradient>
      </Pressable>
    );
  }

  if (variant === 'light') {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [styles.base, styles.light, styles.shadowLight, pressed && styles.pressed, style]}
      >
        <Text style={[type.button, { color: colors.oxRedDark }]}>{children}</Text>
        {icon}
      </Pressable>
    );
  }

  if (variant === 'outline') {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [styles.base, styles.outline, pressed && styles.pressed, style]}
      >
        <Text style={[type.button, { color: colors.ink }]}>{children}</Text>
        {icon}
      </Pressable>
    );
  }

  // ghost
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.ghost, pressed && styles.pressed, style]}
    >
      <Text style={styles.ghostText}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: '100%',
    height: 56,
    borderRadius: radii.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  textWhite: { color: colors.white },
  disabled: { backgroundColor: colors.line2 },
  shadowPrimary: {
    shadowColor: colors.oxRed,
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  light: { backgroundColor: colors.white },
  shadowLight: {
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  outline: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.line2,
  },
  ghost: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14.5,
    color: colors.ink2,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.96,
  },
});

/** Bold accent span for use inside ghost-button text, e.g. "¿Ya tienes cuenta? <b>Inicia sesión</b>" */
export function GhostAccent({ children }: { children: React.ReactNode }) {
  return <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', color: colors.oxRed }}>{children}</Text>;
}
