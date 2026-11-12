// src/components/Estado.tsx
// What a screen shows while it has nothing to list: grey placeholders while
// loading, and one card for "empty" or "could not load" (with a retry).
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Icon } from './Icon';
import { Pressable } from './Pressable';
import { colors, fontFamily, radii, type } from '../theme/tokens';

// Pulsing placeholder cards, shaped like the list that is about to load.
export function Esqueleto({ filas = 3, alto = 92 }: { filas?: number; alto?: number }) {
  const pulso = useRef(new Animated.Value(0.55)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulso, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulso, { toValue: 0.55, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulso]);
  return (
    <Animated.View style={[styles.esqueleto, { opacity: pulso }]} accessibilityLabel="Cargando" accessibilityRole="progressbar">
      {Array.from({ length: filas }, (_, i) => (
        <View key={i} style={[styles.bloque, { minHeight: alto }]}>
          <View style={styles.circulo} />
          <View style={styles.lineas}>
            <View style={[styles.linea, { width: '45%' }]} />
            <View style={[styles.linea, { width: '85%' }]} />
            <View style={[styles.linea, { width: '65%' }]} />
          </View>
        </View>
      ))}
    </Animated.View>
  );
}

export function EstadoVacio({
  icono = 'bell',
  titulo,
  texto,
  accion,
}: {
  icono?: string;
  titulo: string;
  texto?: string;
  accion?: { texto: string; onPress: () => void };
}) {
  return (
    <View style={styles.vacio}>
      <View style={styles.vacioIcono}>
        <Icon name={icono} size={24} color={colors.ink2} />
      </View>
      <Text style={styles.vacioTitulo}>{titulo}</Text>
      {texto ? <Text style={styles.vacioTexto}>{texto}</Text> : null}
      {accion ? (
        <Pressable accessibilityRole="button" style={styles.vacioBoton} onPress={accion.onPress}>
          <Text style={styles.vacioBotonTexto}>{accion.texto}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  esqueleto: { gap: 10 },
  bloque: {
    borderRadius: radii.xl,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    flexDirection: 'row',
    gap: 12,
  },
  circulo: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.field },
  lineas: { flex: 1, gap: 9, paddingTop: 4 },
  linea: { height: 11, borderRadius: 6, backgroundColor: colors.field },
  vacio: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 24, gap: 6 },
  vacioIcono: { width: 54, height: 54, borderRadius: 18, backgroundColor: colors.field, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  vacioTitulo: { fontFamily: fontFamily.extrabold, fontSize: 16, color: colors.ink, textAlign: 'center' },
  vacioTexto: { ...type.caption, color: colors.ink2, textAlign: 'center', maxWidth: 300 },
  vacioBoton: { minHeight: 44, marginTop: 10, paddingHorizontal: 22, borderRadius: radii.pill, backgroundColor: colors.oxRed, alignItems: 'center', justifyContent: 'center' },
  vacioBotonTexto: { fontFamily: fontFamily.extrabold, fontSize: 14, color: colors.white },

});
