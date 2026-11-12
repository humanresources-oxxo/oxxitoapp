// src/components/PinUnaVez.tsx
// Asks for the PIN once for a session from before session keys existed
// (services/sesion.ts): trades it for a key, then the caller retries.
import React, { useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, View } from 'react-native';
import { Pressable } from './Pressable';
import { obtenerLlave } from '../services/sesion';
import { colors, radii, shadows, type, fontFamily, hoja } from '../theme/tokens';

export function PinUnaVez({ numero, onListo, onCerrar }: { numero: string; onListo: () => void; onCerrar: () => void }) {
  const [pin, setPin] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const enviar = async () => {
    if (pin.length !== 4 || enviando) return;
    setEnviando(true);
    setError('');
    try {
      const st = await obtenerLlave(numero, pin);
      if (st === 'ok') return onListo();
      setPin('');
      setError(st === 'locked' ? 'Cuenta bloqueada por varios intentos fallidos. Intenta más tarde.' : 'El PIN no es correcto.');
    } catch {
      setError('No pudimos conectar. Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  };
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onCerrar}>
      <View style={styles.fondo}>
        <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" style={StyleSheet.absoluteFill} onPress={onCerrar} />
        <View style={[styles.hoja, hoja]}>
          <View style={styles.asa} />
          <Text style={styles.titulo}>Confirma tu PIN</Text>
          <Text style={styles.texto}>Solo esta vez: con tu PIN la app queda lista y no te lo vuelve a pedir.</Text>
          <TextInput
            style={styles.input}
            value={pin}
            onChangeText={(t) => setPin(t.replace(/\D/g, '').slice(0, 4))}
            placeholder="••••"
            placeholderTextColor={colors.placeholder}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
            autoFocus
            autoComplete="off"
            onSubmitEditing={enviar}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable accessibilityRole="button" style={[styles.boton, pin.length !== 4 && { opacity: 0.45 }]} onPress={enviar} disabled={pin.length !== 4 || enviando}>
            <Text style={styles.botonTexto}>{enviando ? 'Enviando…' : 'Confirmar'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: colors.velo, justifyContent: 'flex-end', padding: 14 },
  hoja: {
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
  titulo: { fontFamily: fontFamily.titulo, fontSize: 20, color: colors.ink, marginBottom: 6 },
  texto: { fontFamily: fontFamily.semibold, fontSize: 13.5, lineHeight: 19, color: colors.ink2, marginBottom: 14 },
  input: {
    minHeight: 50,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.line2,
    paddingHorizontal: 14,
    fontFamily: fontFamily.semibold,
    fontSize: 20,
    letterSpacing: 8,
    textAlign: 'center',
    color: colors.ink,
  },
  error: { ...type.caption, color: colors.oxRed, marginTop: 10 },
  boton: { minHeight: 50, borderRadius: 16, backgroundColor: colors.oxRed, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  botonTexto: { fontFamily: fontFamily.extrabold, fontSize: 14.5, color: colors.white },

});
