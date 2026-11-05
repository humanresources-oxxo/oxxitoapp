// src/screens/ResumenScreen.tsx
// "Resumen" tab (roles with permissions): the Ficha de Plaza of DashboardsOxxo
// (dashboards/ficha-plaza.html) — vacancies, terminations and store-structure
// usage by advisor, plus the comparison of the 5 plazas — shown inside the app,
// with its own "Descargar" / "Compartir imagen" buttons. It lives in
// DashboardsOxxo so its numbers come from the same calculations as the
// dashboards. Same domain as the app: with ?embed=1 the page reads the app's
// session key (oxxito:sessionKey) and checks it with Supabase, so a session
// from before the key existed confirms the PIN here first.
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { PinUnaVez } from '../components/PinUnaVez';
import { getJson, storageKeys } from '../services/appStorage';
import { leerLlave } from '../services/sesion';
import { colors, radii, type } from '../theme/tokens';

// Same domain as the app on GitHub Pages: on web a path is enough (and keeps
// the session key readable by the page); native opens the full address.
const FICHA_PATH = '/DashboardsOxxo/dashboards/ficha-plaza.html?embed=1';
export const FICHA_URL = 'https://humanresources-oxxo.github.io' + FICHA_PATH;

export function ResumenScreen() {
  const [numero, setNumero] = useState('');
  const [listo, setListo] = useState<boolean | null>(null);
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    getJson<{ numeroEmpleado?: string } | null>(storageKeys.session, null).then((s) => setNumero(s?.numeroEmpleado ?? ''));
    leerLlave().then((l) => setListo(!!l));
  }, []);

  return (
    <View style={styles.screen}>
      <LinearGradient colors={['#FFF7F0', colors.bg, '#FFFFFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>Plaza Oaxaca · ficha</Text>
            <Text style={styles.title}>Resumen</Text>
          </View>
          <Pressable style={styles.headerButton} onPress={() => setRecarga((n) => n + 1)} accessibilityLabel="Actualizar">
            <Icon name="history" size={20} color={colors.ink} />
          </Pressable>
        </View>
      </SafeAreaView>

      {listo === null ? (
        <View style={styles.centro}>
          <ActivityIndicator color={colors.oxRed} />
        </View>
      ) : !listo ? (
        <View style={styles.centro}>
          <PinUnaVez numero={numero} onCerrar={() => setListo(false)} onListo={() => setListo(true)} />
          <Text style={styles.texto}>Confirma tu PIN para ver la ficha.</Text>
        </View>
      ) : Platform.OS === 'web' ? (
        <View style={styles.marco}>
          {React.createElement('iframe', {
            key: recarga,
            src: FICHA_PATH,
            title: 'Ficha de Plaza Oaxaca',
            allow: 'web-share; clipboard-write',
            style: { border: 0, width: '100%', height: '100%', background: colors.bg },
          })}
        </View>
      ) : (
        <View style={styles.centro}>
          <Text style={styles.texto}>La ficha se abre en el navegador.</Text>
          <Pressable style={styles.boton} onPress={() => Linking.openURL(FICHA_URL)}>
            <Text style={styles.botonTexto}>Abrir ficha</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingBottom: 88 },
  safeTop: { backgroundColor: 'rgba(255,255,255,.56)' },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  eyebrow: { ...type.eyebrowSm, color: colors.oxRed, marginBottom: 3 },
  title: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 25, lineHeight: 29, color: colors.ink },
  // Full width, same background as the app: the page inside (embed view)
  // already brings its own cards.
  marco: { flex: 1, backgroundColor: colors.bg },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  texto: { ...type.caption, color: colors.ink2, textAlign: 'center' },
  boton: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: radii.pill, backgroundColor: colors.oxRed },
  botonTexto: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 14, color: colors.white },
});
