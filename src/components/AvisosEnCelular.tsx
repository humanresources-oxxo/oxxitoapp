// src/components/AvisosEnCelular.tsx
// Card on top of Avisos: turn on notifications of new avisos on this phone
// (services/avisosPush.ts). It hides itself where they can't work (native,
// browsers without push, before the Worker has its keys).
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, View } from 'react-native';
import { Icon } from './Icon';
import { Pressable } from './Pressable';
import { activar, desactivar, estado, EstadoPush, probar } from '../services/avisosPush';
import { showAlert } from '../utils/alert';
import { colors, fontFamily, radii } from '../theme/tokens';

const TEXTOS: Partial<Record<EstadoPush, string>> = {
  apagado: 'Recibe un aviso en tu celular cada vez que RH publique algo nuevo.',
  activo: 'Te llegará una notificación con cada aviso nuevo de RH.',
  bloqueado: 'Las notificaciones están bloqueadas para Conoxxo. Actívalas en los ajustes de tu navegador o de tu celular.',
  instalar_iphone: 'En iPhone primero instala Conoxxo en tu pantalla de inicio (Safari → Compartir → Agregar a inicio) y ábrela desde el ícono.',
};

export function AvisosEnCelular() {
  const [e, setE] = useState<EstadoPush | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let vivo = true;
    estado().then((x) => vivo && setE(x)).catch(() => vivo && setE('no_disponible'));
    return () => {
      vivo = false;
    };
  }, []);

  if (!e || e === 'no_disponible' || e === 'no_configurado') return null;

  const encender = async () => {
    setOcupado(true);
    const r = await activar().catch(() => 'error');
    setOcupado(false);
    if (r === 'ok') {
      setE('activo');
      showAlert('Avisos activados', 'Te llegará una notificación con cada aviso nuevo. Puedes mandarte una prueba.');
    } else if (r === 'bloqueado') setE('bloqueado');
    else if (r === 'no_session') showAlert('Confirma tu PIN', 'Cierra la app, vuelve a entrar e inténtalo de nuevo.');
    else showAlert('No se pudo activar', 'Revisa tu conexión e intenta de nuevo.');
  };
  const apagar = async () => {
    setOcupado(true);
    await desactivar();
    setOcupado(false);
    setE('apagado');
  };
  const prueba = async () => {
    setOcupado(true);
    const r = await probar();
    setOcupado(false);
    if (r.ok) showAlert('Prueba enviada', 'En unos segundos te debe llegar la notificación. Si no llega, revisa que el celular no esté en No molestar.');
    else showAlert('No se pudo enviar', r.error === 'limite_diario' ? 'Ya mandaste varias pruebas; intenta en una hora.' : r.error === 'sin_celulares' ? 'Vuelve a activar los avisos en este celular.' : 'Revisa tu conexión e intenta de nuevo.');
  };

  return (
    <View style={[styles.card, e === 'activo' && styles.cardActiva]}>
      <View style={styles.cabeza}>
        <View style={[styles.icono, e === 'activo' && styles.iconoActivo]}>
          <Icon name="bell" size={18} color={e === 'activo' ? colors.white : colors.oxRed} />
        </View>
        <Text style={styles.titulo}>{e === 'activo' ? 'Avisos en tu celular: activos' : 'Avisos en tu celular'}</Text>
      </View>
      <Text style={styles.texto}>{TEXTOS[e]}</Text>
      {ocupado ? (
        <ActivityIndicator color={colors.oxRed} style={{ alignSelf: 'flex-start', marginTop: 6 }} />
      ) : e === 'apagado' ? (
        <Pressable accessibilityRole="button" style={styles.boton} onPress={encender}>
          <Text style={styles.botonTexto}>Activar avisos</Text>
        </Pressable>
      ) : e === 'activo' ? (
        <View style={styles.fila}>
          <Pressable accessibilityRole="button" style={styles.botonSec} onPress={prueba}>
            <Text style={styles.botonSecTexto}>Enviar una prueba</Text>
          </Pressable>
          <Pressable accessibilityRole="button" style={styles.botonSec} onPress={apagar}>
            <Text style={styles.botonSecTexto}>Desactivar</Text>
          </Pressable>
        </View>
      ) : e === 'instalar_iphone' ? (
        <Pressable accessibilityRole="link" style={styles.botonSec} onPress={() => Linking.openURL('/instalar.html')}>
          <Text style={styles.botonSecTexto}>Cómo instalarla</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.xl, backgroundColor: 'rgba(255,255,255,.9)', borderWidth: 1, borderColor: colors.line, padding: 14, gap: 6, marginBottom: 4 },
  cardActiva: { backgroundColor: '#F2FAF5', borderColor: '#CFE9DA' },
  cabeza: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icono: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FDE7E6', alignItems: 'center', justifyContent: 'center' },
  iconoActivo: { backgroundColor: colors.ok },
  titulo: { flex: 1, fontFamily: fontFamily.extrabold, fontSize: 15, color: colors.ink },
  texto: { fontFamily: fontFamily.medium, fontSize: 13.5, lineHeight: 19, color: colors.ink2 },
  fila: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 },
  boton: { alignSelf: 'flex-start', marginTop: 4, backgroundColor: colors.oxRed, borderRadius: radii.pill, paddingHorizontal: 16, paddingVertical: 9 },
  botonTexto: { fontFamily: fontFamily.extrabold, fontSize: 14, color: colors.white },
  botonSec: { alignSelf: 'flex-start', marginTop: 4, borderWidth: 1, borderColor: colors.line2, backgroundColor: colors.white, borderRadius: radii.pill, paddingHorizontal: 14, paddingVertical: 8 },
  botonSecTexto: { fontFamily: fontFamily.bold, fontSize: 13.5, color: colors.ink },
});
