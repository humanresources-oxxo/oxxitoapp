// src/components/OxField.tsx
// Field display — ported from .ox-field / .ox-label / .ox-hint / .ox-locked
import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { Icon } from './Icon';
import { colors, radii, type } from '../theme/tokens';

type OxFieldProps = {
  icon?: string;
  label?: string;
  value?: string;
  placeholder?: string;
  focused?: boolean;
  tail?: string;
  locked?: boolean;
  onChangeText?: (value: string) => void;
};

export function OxField({ icon, label, value, placeholder, focused, tail, locked, onChangeText }: OxFieldProps) {
  const hasValue = !!value;
  return (
    <View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View
        style={[
          styles.field,
          focused && styles.focused,
          locked && styles.locked,
        ]}
      >
        {icon ? (
          <View style={styles.icon}>
            <Icon name={icon} size={21} color={colors.ink3} />
          </View>
        ) : null}
        {onChangeText ? (
          <TextInput
            style={[styles.value, styles.input]}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={colors.ink3}
            editable={!locked}
          />
        ) : (
          <Text style={[styles.value, !hasValue && styles.placeholder]} numberOfLines={1}>
            {value || placeholder}
          </Text>
        )}
        {focused && !onChangeText ? <View style={styles.caret} /> : null}
        {tail ? <Text style={styles.tail}>{tail}</Text> : null}
      </View>
    </View>
  );
}

export function OxHint({ children }: { children: React.ReactNode }) {
  return <Text style={styles.hint}>{children}</Text>;
}

export function OxLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

const styles = StyleSheet.create({
  label: {
    ...type.label,
    color: colors.ink,
    marginBottom: 8,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.line2,
    borderRadius: radii.lg,
    paddingHorizontal: 16,
    height: 58,
  },
  focused: {
    borderColor: colors.oxRed,
    backgroundColor: colors.white,
  },
  locked: {
    backgroundColor: colors.field,
    borderStyle: 'solid',
    borderColor: colors.line,
  },
  icon: {
    flexShrink: 0,
  },
  value: {
    flex: 1,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 17,
    color: colors.ink,
    letterSpacing: 0.1,
  },
  placeholder: {
    color: colors.ink3,
    fontFamily: 'PlusJakartaSans_500Medium',
  },
  input: {
    padding: 0,
  },
  caret: {
    width: 2,
    height: 22,
    backgroundColor: colors.oxRed,
    borderRadius: 2,
    marginLeft: -4,
  },
  tail: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
    color: colors.ink3,
  },
  hint: {
    ...type.caption,
    color: colors.ink3,
    marginTop: 9,
    marginHorizontal: 2,
  },
});
