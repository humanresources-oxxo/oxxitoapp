// src/screens/EstructuraScreen.tsx
// Estructura: each store's positions from DashboardsOxxo's Dashboard 1, who
// holds each one and which are vacant (and since when). Plaza Oaxaca only,
// with search by store, CR or employee and "Mis tiendas" for the logged-in AT.
// Only for the same puestos as Actas (see services/actas.ts).
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { getJson, storageKeys } from '../services/appStorage';
import {
  buscarTiendas,
  cargarEstructura,
  Corte,
  diasVacante,
  fechaActualizacion,
  mesTexto,
  TiendaEstructura,
  totales,
} from '../services/estructura';
import { normalizarNombre } from '../services/gviz';
import { colors, gradients, radii, shadows, type } from '../theme/tokens';

type Sesion = { nombre?: string } | null;

const MAX_LISTA = 80;
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function fechaCorta(iso: string) {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${+m[3]} ${MESES[+m[2] - 1]} ${m[1]}` : iso || '—';
}
const num = (n: number) => n.toLocaleString('es-MX');
const pct = (x: number) => `${(x * 100).toLocaleString('es-MX', { maximumFractionDigits: 1 })}%`;
const plural = (n: number, uno: string, varios: string) => `${num(n)} ${n === 1 ? uno : varios}`;

export function EstructuraScreen({ onBack }: { onBack: () => void }) {
  const [sesion, setSesion] = useState<Sesion>(null);
  const [corte, setCorte] = useState<Corte | null>(null);
  const [error, setError] = useState(false);
  const [intento, setIntento] = useState(0);
  const [actualizado, setActualizado] = useState('');
  const [texto, setTexto] = useState('');
  const [soloMias, setSoloMias] = useState(true);
  const [conVacantes, setConVacantes] = useState(false);
  const [detalle, setDetalle] = useState<TiendaEstructura | null>(null);

  useEffect(() => {
    getJson<Sesion>(storageKeys.session, null).then(setSesion);
    fechaActualizacion().then(setActualizado);
  }, []);

  useEffect(() => {
    let activo = true;
    setCorte(null);
    setError(false);
    cargarEstructura()
      .then((c) => activo && setCorte(c))
      .catch(() => activo && setError(true));
    return () => {
      activo = false;
    };
  }, [intento]);

  // "Mis tiendas" only exists when the logged-in person is the AT of some stores.
  const yo = normalizarNombre(sesion?.nombre);
  const tengoTiendas = useMemo(() => !!yo && !!corte?.tiendas.some((t) => normalizarNombre(t.asesor) === yo), [corte, yo]);
  const resultado = useMemo(() => {
    const base = buscarTiendas(corte?.tiendas || [], texto, tengoTiendas && soloMias ? sesion?.nombre : undefined);
    return conVacantes ? base.filter((t) => t.vacantes > 0) : base;
  }, [corte, texto, tengoTiendas, soloMias, conVacantes, sesion?.nombre]);
  const t = totales(resultado);

  return (
    <View style={styles.screen}>
      <LinearGradient colors={['#FFF7F0', colors.bg, '#FFFFFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={styles.header}>
          <Pressable style={styles.headerButton} onPress={onBack} accessibilityLabel="Regresar">
            <Icon name="chevL" size={20} color={colors.ink} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>
              Plaza Oaxaca
              {actualizado ? ` · ${actualizado}` : ''}
            </Text>
            <Text style={styles.title}>Estructura</Text>
          </View>
        </View>
      </SafeAreaView>

      <FlatList
        data={resultado.slice(0, MAX_LISTA)}
        keyExtractor={(x) => x.cr || x.tienda}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={{ gap: 10 }}>
            {corte ? (
              <LinearGradient colors={gradients.oxGrad.colors} start={gradients.oxGrad.start} end={gradients.oxGrad.end} style={styles.hero}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.heroKicker}>Cobertura{corte.mes ? ` · ${mesTexto(corte.mes)}` : ''}</Text>
                  <Text style={styles.heroNumero}>{pct(t.cobertura)}</Text>
                  <Text style={styles.heroBody}>
                    {plural(t.ocupadas, 'posición ocupada', 'posiciones ocupadas')} de {num(t.total)}
                  </Text>
                </View>
                <View style={styles.heroVacantes}>
                  <Text style={styles.heroVacNum}>{num(t.vacantes)}</Text>
                  <Text style={styles.heroVacTxt}>{t.vacantes === 1 ? 'vacante' : 'vacantes'}</Text>
                </View>
              </LinearGradient>
            ) : null}

            <View style={styles.buscador}>
              <Icon name="search" size={18} color={colors.ink3} />
              <TextInput
                style={styles.buscadorInput}
                value={texto}
                onChangeText={setTexto}
                placeholder="Tienda, CR o colaborador"
                placeholderTextColor={colors.ink3}
                autoCorrect={false}
                returnKeyType="search"
              />
            </View>
            <View style={styles.chips}>
              {tengoTiendas ? <Chip texto="Mis tiendas" activo={soloMias} onPress={() => setSoloMias((x) => !x)} /> : null}
              <Chip texto="Con vacantes" activo={conVacantes} onPress={() => setConVacantes((x) => !x)} />
            </View>
            {corte ? (
              <Text style={styles.resumen}>
                {plural(t.tiendas, 'tienda', 'tiendas')}
                {resultado.length > MAX_LISTA ? ` · se muestran ${MAX_LISTA}, usa la búsqueda` : ''}
              </Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          error ? (
            <View style={[styles.card, styles.aviso]}>
              <Icon name="alert" size={26} color={colors.oxRed} />
              <Text style={styles.avisoTitulo}>No se pudo cargar la estructura</Text>
              <Text style={styles.avisoTexto}>Revisa tu conexión e intenta de nuevo.</Text>
              <Pressable style={styles.avisoBoton} onPress={() => setIntento((i) => i + 1)}>
                <Text style={styles.avisoBotonTexto}>Reintentar</Text>
              </Pressable>
            </View>
          ) : !corte ? (
            <View style={styles.cargando}>
              <ActivityIndicator color={colors.oxRed} />
            </View>
          ) : (
            <Text style={styles.nota}>Ninguna tienda coincide con la búsqueda.</Text>
          )
        }
        renderItem={({ item }) => {
          const total = item.ocupadas + item.vacantes;
          return (
            <Pressable style={styles.tienda} onPress={() => setDetalle(item)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.tiendaNombre} numberOfLines={1}>
                  {item.tienda}
                </Text>
                <Text style={styles.tiendaMeta} numberOfLines={1}>
                  {item.cr || 'Sin CR'} · {item.asesor || 'Sin asesor'}
                </Text>
                <View style={styles.barra}>
                  <View style={[styles.barraLlena, { flex: item.ocupadas }]} />
                  <View style={{ flex: item.vacantes }} />
                </View>
                <Text style={styles.tiendaOcup}>
                  {num(item.ocupadas)} de {num(total)} ocupadas
                </Text>
              </View>
              <View style={[styles.vacBadge, item.vacantes === 0 && styles.vacBadgeOk]}>
                <Text style={[styles.vacNum, item.vacantes === 0 && { color: colors.ok }]}>{item.vacantes}</Text>
                <Text style={styles.vacTxt}>{item.vacantes === 1 ? 'vacante' : 'vacantes'}</Text>
              </View>
            </Pressable>
          );
        }}
      />

      <Modal visible={!!detalle} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDetalle(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>
                {detalle?.cr} · {detalle?.asesor || 'Sin asesor'}
              </Text>
              <Text style={styles.title} numberOfLines={2}>
                {detalle?.tienda}
              </Text>
            </View>
            <Pressable style={styles.headerButton} onPress={() => setDetalle(null)} accessibilityLabel="Cerrar">
              <Icon name="close" size={20} color={colors.ink} />
            </Pressable>
          </View>
          {detalle ? <DetalleTienda t={detalle} /> : null}
        </SafeAreaView>
      </Modal>
    </View>
  );
}

function DetalleTienda({ t }: { t: TiendaEstructura }) {
  const vacantes = t.posiciones.filter((p) => !p.empleado);
  const ocupadas = t.posiciones.filter((p) => p.empleado);
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.fila}>
        <Dato titulo="Posiciones" valor={num(t.posiciones.length)} />
        <Dato titulo="Ocupadas" valor={num(t.ocupadas)} />
        <Dato titulo="Vacantes" valor={num(t.vacantes)} rojo={t.vacantes > 0} />
      </View>
      {vacantes.length ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Vacantes</Text>
          {vacantes.map((p, i) => {
            const d = diasVacante(p.vacanteDesde);
            return (
              <View key={p.id || i} style={[styles.pos, i < vacantes.length - 1 && styles.posLinea]}>
                <View style={[styles.punto, { backgroundColor: colors.oxRed }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.posPuesto}>{p.puesto}</Text>
                  <Text style={styles.posMeta}>
                    Desde {fechaCorta(p.vacanteDesde)}
                    {d === 0 ? ' · hoy' : d !== null ? ` · ${plural(d, 'día', 'días')}` : ''}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      ) : null}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Ocupadas</Text>
        {ocupadas.length ? (
          ocupadas.map((p, i) => (
            <View key={p.id || i} style={[styles.pos, i < ocupadas.length - 1 && styles.posLinea]}>
              <View style={[styles.punto, { backgroundColor: colors.ok }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.posPuesto}>{p.empleado}</Text>
                <Text style={styles.posMeta}>{p.puesto}</Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.nota}>Sin posiciones ocupadas.</Text>
        )}
      </View>
    </ScrollView>
  );
}

function Dato({ titulo, valor, rojo }: { titulo: string; valor: string; rojo?: boolean }) {
  return (
    <View style={[styles.card, styles.dato]}>
      <Text style={styles.datoTitulo}>{titulo}</Text>
      <Text style={[styles.datoValor, rojo && { color: colors.oxRed }]}>{valor}</Text>
    </View>
  );
}

function Chip({ texto, activo, onPress }: { texto: string; activo: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.chip, activo && styles.chipActivo]} onPress={onPress} accessibilityState={{ selected: activo }}>
      <Text style={[styles.chipText, activo && styles.chipTextActivo]}>{texto}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingBottom: 108 },
  safeTop: { backgroundColor: 'rgba(255,255,255,.56)' },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerCopy: { flex: 1 },
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
  nota: { ...type.caption, color: colors.ink2 },
  hero: { borderRadius: 24, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 14, ...shadows.hero },
  heroKicker: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 12, color: 'rgba(255,255,255,.84)', textTransform: 'uppercase' },
  heroNumero: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 44, lineHeight: 52, color: colors.white, marginTop: 2 },
  heroBody: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, lineHeight: 18, color: 'rgba(255,255,255,.9)' },
  heroVacantes: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,.2)', borderRadius: 18, paddingVertical: 12, paddingHorizontal: 14, minWidth: 86 },
  heroVacNum: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 28, color: colors.white },
  heroVacTxt: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: 'rgba(255,255,255,.9)' },
  card: {
    borderRadius: radii.xl,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    ...shadows.card,
  },
  cardTitle: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 16, color: colors.ink, marginBottom: 4 },
  aviso: { alignItems: 'center', gap: 8, paddingVertical: 28 },
  avisoTitulo: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 16, color: colors.ink, textAlign: 'center' },
  avisoTexto: { ...type.caption, color: colors.ink2, textAlign: 'center', maxWidth: 300 },
  avisoBoton: { marginTop: 6, paddingHorizontal: 18, paddingVertical: 10, borderRadius: radii.pill, backgroundColor: colors.oxRed },
  avisoBotonTexto: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13.5, color: colors.white },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: radii.pill, backgroundColor: colors.field, borderWidth: 1, borderColor: colors.line },
  chipActivo: { backgroundColor: colors.oxRed, borderColor: colors.oxRed },
  chipText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: colors.ink2 },
  chipTextActivo: { color: colors.white },
  buscador: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: colors.line2,
    borderRadius: radii.md,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    minHeight: 50,
  },
  buscadorInput: { flex: 1, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 15, color: colors.ink, paddingVertical: 12 },
  resumen: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: colors.ink3 },
  tienda: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: radii.xl,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  tiendaNombre: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 14.5, color: colors.ink },
  tiendaMeta: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: colors.ink2, marginTop: 2 },
  barra: { flexDirection: 'row', height: 6, borderRadius: 3, backgroundColor: '#FFE1DA', overflow: 'hidden', marginTop: 8 },
  barraLlena: { backgroundColor: colors.ok },
  tiendaOcup: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11.5, color: colors.ink3, marginTop: 4 },
  vacBadge: { alignItems: 'center', minWidth: 64, paddingVertical: 8, borderRadius: 14, backgroundColor: '#FFF0EC' },
  vacBadgeOk: { backgroundColor: '#EAF6F0' },
  vacNum: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 22, color: colors.oxRed },
  vacTxt: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: colors.ink3 },
  fila: { flexDirection: 'row', gap: 10 },
  dato: { flex: 1, padding: 12 },
  datoTitulo: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: colors.ink2 },
  datoValor: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 22, color: colors.ink, marginTop: 4 },
  pos: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  posLinea: { borderBottomWidth: 1, borderBottomColor: colors.line },
  punto: { width: 9, height: 9, borderRadius: 5 },
  posPuesto: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: colors.ink },
  posMeta: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: colors.ink2, marginTop: 2 },
});
