// src/components/Fondo.tsx
// Page background behind every screen: the warm gradient plus a few soft
// blobs of the logo colours. They give the frosted-glass pieces (tab bar,
// headers, pills) something to show through.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { gradients } from '../theme/tokens';

// Position and radius in % of the screen (the Svg stretches to fill it).
const MANCHAS = [
  { id: 'a', cx: 8, cy: 6, r: 46, color: '#F6B800', fuerza: 0.3 },
  { id: 'b', cx: 100, cy: 30, r: 40, color: '#FF7A59', fuerza: 0.2 },
  { id: 'c', cx: 0, cy: 70, r: 44, color: '#FF9F1C', fuerza: 0.18 },
  { id: 'd', cx: 92, cy: 98, r: 48, color: '#E30613', fuerza: 0.13 },
];

export function Fondo() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={gradients.fondo.colors} start={gradients.fondo.start} end={gradients.fondo.end} style={StyleSheet.absoluteFill} />
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
        <Defs>
          {MANCHAS.map((m) => (
            <RadialGradient key={m.id} id={`mancha-${m.id}`} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={m.color} stopOpacity={m.fuerza} />
              <Stop offset="1" stopColor={m.color} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>
        {MANCHAS.map((m) => (
          <Circle key={m.id} cx={m.cx} cy={m.cy} r={m.r} fill={`url(#mancha-${m.id})`} />
        ))}
      </Svg>
    </View>
  );
}
