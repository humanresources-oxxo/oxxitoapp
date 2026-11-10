// src/screens/AltasScreen.tsx
// "Altas por aprobar": new accounts of the approver's people (asesor: their
// stores per the roster; RH and Gerente de plaza: everyone) waiting to be
// approved before they can sign in (migration 39). Approve if it is really
// that person; reject frees the account so the real employee can register.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { PinUnaVez } from '../components/PinUnaVez';
import { Alta, listarAltas, resolverAlta } from '../services/altas';
import { getJson, storageKeys } from '../services/appStorage';
import { leerLlave, olvidarLlave } from '../services/sesion';
import { colors, gradients, radii, shadows, type } from '../theme/tokens';
import { confirmAlert, showAlert } from '../utils/alert';

const cuando = new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function AltasScreen({ onBack, onCambio }: { onBack: () => void; onCambio?: () => void }) {
  const [numero, setNumero] = useState('');
  const [altas, setAltas] = useState<Alta[] | null>(null);
  const [error, setError] = useState(false);
  const [pedirPin, setPedirPin] = useState(false);
  const [ocupado, setOcupado] = useState('');

  const cargar = useCallback(async () => {
    setError(false);
    const llave = await leerLlave();
    if (!llave) return setPedirPin(true);
    try {
      const lista = await listarAltas(llave);
      if (lista === null) {
        await olvidarLlave();
        return setPedirPin(true);
      }
      setAltas(lista);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    getJson<{ numeroEmpleado?: string } | null>(storageKeys.session, null).then((s) => setNumero(s?.numeroEmpleado ?? ''));
    cargar();
  }, [cargar]);

  const resolver = async (a: Alta, aprobar: boolean) => {
    const ok = aprobar
      ? await confirmAlert('Aprobar cuenta', `¿Es ${a.nombre} (${a.numero}) quien se registró? Con tu aprobación ya puede entrar a Conoxxo.`, 'Aprobar')
      : await confirmAlert('Rechazar cuenta', `Se borra el registro de ${a.nombre} (${a.numero}). Si fue un error, la persona puede volver a registrarse.`, 'Rechazar');
    if (!ok) return;
    setOcupado(a.numero);
    try {
      const r = await resolverAlta((await leerLlave()) ?? '', a.numero, aprobar);
      if (r === 'no_session') {
        await olvidarLlave();
        return setPedirPin(true);
      }
      if (r === 'not_allowed') showAlert('No se pudo', 'Esa persona no es de tus tiendas.');
      await cargar();
      onCambio?.();
    } catch {
      showAlert('Sin conexión', 'No pudimos guardar. Intenta de nuevo.');
    } finally {
      setOcupado('');
    }
  };

  return (
    <View style={styles.screen}>
      <LinearGradient colors={['#FFF7F0', colors.bg, '#FFFFFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" style={styles.headerButton} onPress={onBack} accessibilityLabel="Regresar">
            <Icon name="chevL" size={20} color={colors.ink} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>Cuentas nuevas</Text>
            <Text style={styles.title}>Altas por aprobar</Text>
          </View>
        </View>
      </SafeAreaView>

      {error ? (
        <View style={styles.content}>
          <View style={[styles.card, styles.aviso]}>
            <Icon name="alert" size={26} color={colors.oxRed} />
            <Text style={styles.avisoTitulo}>No se pudieron cargar</Text>
            <Pressable accessibilityRole="button" style={styles.boton} onPress={cargar}>
              <Text style={styles.botonTexto}>Reintentar</Text>
            </Pressable>
          </View>
        </View>
      ) : !altas ? (
        <View style={styles.cargando}>{pedirPin ? null : <ActivityIndicator color={colors.oxRed} />}</View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <LinearGradient colors={gradients.green.colors} start={gradients.green.start} end={gradients.green.end} style={styles.hero}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroKicker}>{altas.length ? 'Por revisar' : 'Todo al día'}</Text>
              <Text style={styles.heroNumero}>{altas.length}</Text>
              <Text style={styles.heroBody}>Aprueba solo si sabes que es esa persona. Si dudas, pregúntale en tienda.</Text>
            </View>
            <View style={styles.heroIcono}>
              <Icon name="user" size={28} color="#fff" />
            </View>
          </LinearGradient>

          {altas.map((a) => (
            <View key={a.numero} style={[styles.card, { gap: 10 }]}>
              <View>
                <Text style={styles.nombre}>{a.nombre}</Text>
                <Text style={styles.meta}>
                  {a.numero}
                  {a.tienda ? ` · ${a.tienda}` : ''}
                  {a.puesto ? ` · ${a.puesto}` : ''}
                </Text>
                {a.registradaEn ? <Text style={styles.meta}>Se registró {cuando.format(a.registradaEn)}</Text> : null}
              </View>
              <View style={styles.fila}>
                <Pressable style={[styles.boton, { flex: 1 }]} onPress={() => resolver(a, true)} disabled={!!ocupado} accessibilityRole="button">
                  <Icon name="check" size={16} color={colors.white} />
                  <Text style={styles.botonTexto}>Aprobar</Text>
                </Pressable>
                <Pressable style={[styles.botonSec, { flex: 1 }]} onPress={() => resolver(a, false)} disabled={!!ocupado} accessibilityRole="button">
                  <Icon name="close" size={16} color={colors.oxRed} />
                  <Text style={styles.botonSecTexto}>Rechazar</Text>
                </Pressable>
              </View>
            </View>
          ))}

          {!altas.length ? <Text style={styles.nota}>Cuando alguien de tus tiendas se registre en Conoxxo, aparecerá aquí para que lo apruebes.</Text> : null}
        </ScrollView>
      )}

      {pedirPin ? (
        <PinUnaVez
          numero={numero}
          onCerrar={() => {
            setPedirPin(false);
            onBack();
          }}
          onListo={() => {
            setPedirPin(false);
            cargar();
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingBottom: 108 },
  safeTop: { backgroundColor: 'rgba(255,255,255,.56)' },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
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
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 12 },
  cargando: { paddingVertical: 48, alignItems: 'center' },
  hero: { borderRadius: 24, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 14, ...shadows.hero },
  heroKicker: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 12, color: 'rgba(255,255,255,.84)', textTransform: 'uppercase' },
  heroNumero: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 52, lineHeight: 60, color: colors.white },
  heroBody: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12.5, lineHeight: 18, color: 'rgba(255,255,255,.92)' },
  heroIcono: { width: 64, height: 64, borderRadius: 22, backgroundColor: 'rgba(255,255,255,.2)', alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: radii.xl, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, padding: 16, ...shadows.card },
  nombre: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 16.5, color: colors.ink },
  meta: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12.5, color: colors.ink2, marginTop: 3 },
  fila: { flexDirection: 'row', gap: 10 },
  boton: { minHeight: 46, borderRadius: 14, backgroundColor: colors.ok, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, paddingHorizontal: 14 },
  botonTexto: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 14, color: colors.white },
  botonSec: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#F3B8B0',
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  botonSecTexto: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 14, color: colors.oxRed },
  nota: { ...type.caption, color: colors.ink2 },
  aviso: { alignItems: 'center', gap: 10, paddingVertical: 28 },
  avisoTitulo: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 16, color: colors.ink },
});
