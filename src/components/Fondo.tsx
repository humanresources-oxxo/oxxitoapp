// src/components/Fondo.tsx
// Page background behind every screen: plain white. One component, so the
// whole app changes in one place.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../theme/tokens';

export function Fondo() {
  return <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.white }]} pointerEvents="none" />;
}
