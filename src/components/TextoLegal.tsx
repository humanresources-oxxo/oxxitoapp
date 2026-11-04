// src/components/TextoLegal.tsx
// Sheet with a legal text (aviso de privacidad, términos de uso:
// src/data/legal.ts), opened from Permisos and Perfil.
import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors, radii, shadows } from '../theme/tokens';

export function TextoLegal({ titulo, parrafos, onClose }: { titulo: string; parrafos: string[]; onClose: () => void }) {
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <View style={styles.fondo}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <BlurView intensity={36} tint="light" style={styles.hoja}>
          <View style={styles.asa} />
          <Text style={styles.titulo}>{titulo}</Text>
          <ScrollView style={{ flexGrow: 0 }} showsVerticalScrollIndicator={false}>
            {parrafos.map((p, i) => (
              <Text key={i} style={styles.parrafo}>
                {p}
              </Text>
            ))}
          </ScrollView>
          <Pressable style={styles.boton} onPress={onClose} accessibilityRole="button">
            <Text style={styles.botonTexto}>Entendido</Text>
          </Pressable>
        </BlurView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: 'rgba(36,26,23,.24)', justifyContent: 'flex-end', padding: 14 },
  hoja: {
    maxHeight: '86%',
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,.96)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.96)',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 22,
    ...shadows.sheet,
  },
  asa: { alignSelf: 'center', width: 42, height: 5, borderRadius: radii.pill, backgroundColor: colors.line2, marginBottom: 14 },
  titulo: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 20, color: colors.ink, marginBottom: 10 },
  parrafo: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, lineHeight: 21, color: colors.ink2, marginBottom: 12 },
  boton: { minHeight: 50, borderRadius: 16, backgroundColor: colors.oxRed, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  botonTexto: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 14.5, color: colors.white },
});
