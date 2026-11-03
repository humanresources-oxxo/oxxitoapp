// src/screens/DilosScreen.tsx
// Casos DILOS, app only: open cases of the Zona Centro Sur at the report's
// cut, how long they have been open, who is handling them (RH or
// Administración), by región and plaza, and the list from oldest to newest.
// No names: the facilitator never reaches the app (services/dilos.ts).
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { cargarDilos, CasoDilos, contarPor, Dilos, DIAS_ALERTA } from '../services/dilos';
import { normalizarNombre } from '../services/gviz';
import { colors, gradients, radii, shadows, type } from '../theme/tokens';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function fecha(iso?: string) {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${+m[3]} ${MESES[+m[2] - 1]} ${m[1]}` : '';
}
// "ACAPULCO" -> "Acapulco"; acronyms like CDMX stay as they are.
const SIGLAS = new Set(['CDMX', 'EDOMEX']);
const titulo = (s: string) =>
  s
    .split(' ')
    .map((w) => (SIGLAS.has(w.toUpperCase()) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(' ');
type Filtro = 'todos' | 'RH' | 'ADM' | 'atrasados';

export function DilosScreen({ onBack }: { onBack: () => void }) {
  const [dilos, setDilos] = useState<Dilos | null>(null);
  const [error, setError] = useState(false);
  const [intento, setIntento] = useState(0);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [region, setRegion] = useState('');
  const [texto, setTexto] = useState('');

  useEffect(() => {
    let activo = true;
    setDilos(null);
    setError(false);
    cargarDilos()
      .then((d) => activo && setDilos(d))
      .catch(() => activo && setError(true));
    return () => {
      activo = false;
    };
  }, [intento]);

  const casos = dilos?.casos || [];
  const rh = casos.filter((c) => c.area === 'RH').length;
  const adm = casos.filter((c) => c.area === 'ADM').length;
  const atrasados = casos.filter((c) => c.dias > DIAS_ALERTA).length;
  const promedio = casos.length ? casos.reduce((s, c) => s + c.dias, 0) / casos.length : 0;
  const regiones = useMemo(() => contarPor(casos, 'region'), [casos]);
  const plazas = useMemo(() => contarPor(casos, 'plaza'), [casos]);
  const maxPlaza = Math.max(1, ...plazas.map(([, n]) => n));
  const tabasco = casos.filter((c) => normalizarNombre(c.region) === 'TABASCO').length;

  const lista = useMemo(() => {
    const n = normalizarNombre(texto);
    return casos.filter((c: CasoDilos) => {
      if (filtro === 'RH' && c.area !== 'RH') return false;
      if (filtro === 'ADM' && c.area !== 'ADM') return false;
      if (filtro === 'atrasados' && c.dias <= DIAS_ALERTA) return false;
      if (region && c.region !== region) return false;
      return !n || normalizarNombre(`${c.caso} ${c.plaza} ${c.region}`).includes(n);
    });
  }, [casos, filtro, region, texto]);

  return (
    <View style={styles.screen}>
      <LinearGradient colors={['#FFF7F0', colors.bg, '#FFFFFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={styles.header}>
          <Pressable style={styles.headerButton} onPress={onBack} accessibilityLabel="Regresar">
            <Icon name="chevL" size={20} color={colors.ink} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>Zona Centro Sur{dilos?.corte ? ` · corte ${fecha(dilos.corte)}` : ''}</Text>
            <Text style={styles.title}>Casos DILOS</Text>
          </View>
        </View>
      </SafeAreaView>

      {error ? (
        <View style={styles.content}>
          <Aviso titulo="No se pudieron cargar los casos" texto="Revisa tu conexión e intenta de nuevo." accion={{ texto: 'Reintentar', onPress: () => setIntento((i) => i + 1) }} />
        </View>
      ) : !dilos ? (
        <View style={styles.cargando}>
          <ActivityIndicator color={colors.oxRed} />
        </View>
      ) : !casos.length ? (
        <View style={styles.content}>
          <Aviso titulo="Sin casos abiertos" texto="RH aún no ha cargado el reporte DILOS o el último corte no trae casos." />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <LinearGradient colors={gradients.oxGrad.colors} start={gradients.oxGrad.start} end={gradients.oxGrad.end} style={styles.hero}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroKicker}>Casos abiertos</Text>
              <Text style={styles.heroNumero}>{casos.length}</Text>
              <Text style={styles.heroBody}>
                {promedio.toLocaleString('es-MX', { maximumFractionDigits: 1 })} días abiertos en promedio · el más antiguo, {casos[0].dias} días
              </Text>
            </View>
            <View style={styles.heroLado}>
              <Text style={styles.heroLadoNum}>{atrasados}</Text>
              <Text style={styles.heroLadoTxt}>con más de {DIAS_ALERTA} días</Text>
            </View>
          </LinearGradient>

          <View style={styles.fila}>
            <Dato titulo="En atención RH" valor={String(rh)} />
            <Dato titulo="En atención ADM" valor={String(adm)} />
            <Dato titulo="Región Tabasco" valor={String(tabasco)} nota="región de Plaza Oaxaca" />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Por plaza</Text>
            {plazas.map(([p, n]) => (
              <View key={p} style={styles.barraFila}>
                <Text style={styles.barraEtq} numberOfLines={1}>
                  {titulo(p)}
                </Text>
                <View style={styles.barraFondo}>
                  <View style={[styles.barraLlena, { width: `${Math.max(6, (n / maxPlaza) * 100)}%` }]} />
                </View>
                <Text style={styles.barraValor}>{n}</Text>
              </View>
            ))}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            <Chip texto="Todas las regiones" activo={!region} onPress={() => setRegion('')} />
            {regiones.map(([r, n]) => (
              <Chip key={r} texto={`${titulo(r)} · ${n}`} activo={region === r} onPress={() => setRegion(region === r ? '' : r)} />
            ))}
          </ScrollView>
          <View style={styles.chipsFila}>
            {(
              [
                ['todos', 'Todos'],
                ['RH', 'RH'],
                ['ADM', 'Administración'],
                ['atrasados', `Más de ${DIAS_ALERTA} días`],
              ] as Array<[Filtro, string]>
            ).map(([k, t]) => (
              <Chip key={k} texto={t} activo={filtro === k} onPress={() => setFiltro(k)} />
            ))}
          </View>
          <View style={styles.buscador}>
            <Icon name="search" size={18} color={colors.ink3} />
            <TextInput
              style={styles.buscadorInput}
              value={texto}
              onChangeText={setTexto}
              placeholder="Número de caso o plaza"
              placeholderTextColor={colors.ink3}
              autoCorrect={false}
            />
          </View>
          <Text style={styles.resumen}>
            {lista.length} {lista.length === 1 ? 'caso' : 'casos'} · del más antiguo al más reciente
          </Text>
          {lista.map((c) => (
            <View key={c.caso} style={[styles.caso, c.dias > DIAS_ALERTA && styles.casoAtrasado]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.casoNum}>{c.caso}</Text>
                <Text style={styles.casoMeta} numberOfLines={1}>
                  {titulo(c.plaza)} · {titulo(c.region)}
                </Text>
                <View style={[styles.pill, c.area === 'RH' ? styles.pillRh : styles.pillAdm]}>
                  <Text style={[styles.pillTxt, c.area === 'RH' ? styles.pillTxtRh : styles.pillTxtAdm]}>{c.estatus || c.area}</Text>
                </View>
              </View>
              <View style={styles.dias}>
                <Text style={[styles.diasNum, c.dias > DIAS_ALERTA && { color: colors.oxRed }]}>{c.dias}</Text>
                <Text style={styles.diasTxt}>{c.dias === 1 ? 'día' : 'días'}</Text>
              </View>
            </View>
          ))}
          <Text style={styles.nota}>
            Reporte DILOS que carga RH en el panel admin. No incluye el nombre del facilitador. "Días" son los días abiertos al corte del
            reporte.
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

function Dato({ titulo, valor, nota }: { titulo: string; valor: string; nota?: string }) {
  return (
    <View style={[styles.card, styles.kpi]}>
      <Text style={styles.kpiTitulo} numberOfLines={2}>
        {titulo}
      </Text>
      <Text style={styles.kpiValor}>{valor}</Text>
      {nota ? <Text style={styles.kpiNota}>{nota}</Text> : null}
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

function Aviso({ titulo, texto, accion }: { titulo: string; texto: string; accion?: { texto: string; onPress: () => void } }) {
  return (
    <View style={[styles.card, styles.aviso]}>
      <Icon name="alert" size={26} color={colors.oxRed} />
      <Text style={styles.avisoTitulo}>{titulo}</Text>
      <Text style={styles.avisoTexto}>{texto}</Text>
      {accion ? (
        <Pressable style={styles.avisoBoton} onPress={accion.onPress}>
          <Text style={styles.avisoBotonTexto}>{accion.texto}</Text>
        </Pressable>
      ) : null}
    </View>
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
  heroNumero: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 52, lineHeight: 60, color: colors.white },
  heroBody: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12.5, lineHeight: 18, color: 'rgba(255,255,255,.9)' },
  heroLado: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,.2)', borderRadius: 18, paddingVertical: 12, paddingHorizontal: 12, width: 96 },
  heroLadoNum: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 28, color: colors.white },
  heroLadoTxt: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11.5, color: 'rgba(255,255,255,.9)', textAlign: 'center' },
  fila: { flexDirection: 'row', gap: 10 },
  card: {
    borderRadius: radii.xl,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    ...shadows.card,
  },
  cardTitle: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 16, color: colors.ink, marginBottom: 8 },
  kpi: { flex: 1, padding: 12 },
  kpiTitulo: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11.5, color: colors.ink2 },
  kpiValor: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 24, color: colors.ink, marginTop: 4 },
  kpiNota: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, color: colors.ink3, marginTop: 2 },
  barraFila: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
  barraEtq: { width: 96, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12.5, color: colors.ink2 },
  barraFondo: { flex: 1, height: 9, borderRadius: 5, backgroundColor: colors.field, overflow: 'hidden' },
  barraLlena: { height: 9, borderRadius: 5, backgroundColor: colors.oxRed },
  barraValor: { width: 26, textAlign: 'right', fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12.5, color: colors.ink },
  chips: { flexDirection: 'row', gap: 8 },
  chipsFila: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
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
  caso: {
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
  casoAtrasado: { borderColor: '#FFC9BF' },
  casoNum: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 14.5, color: colors.ink },
  casoMeta: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: colors.ink2, marginTop: 2 },
  pill: { alignSelf: 'flex-start', marginTop: 6, paddingHorizontal: 9, paddingVertical: 3, borderRadius: radii.pill },
  pillRh: { backgroundColor: '#E8F0FB' },
  pillAdm: { backgroundColor: '#FFF6E0' },
  pillTxt: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11.5 },
  pillTxtRh: { color: colors.oxBlue },
  pillTxtAdm: { color: '#8A6100' },
  dias: { alignItems: 'center', minWidth: 52 },
  diasNum: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 24, color: colors.ink },
  diasTxt: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: colors.ink3 },
  aviso: { alignItems: 'center', gap: 8, paddingVertical: 28 },
  avisoTitulo: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 16, color: colors.ink, textAlign: 'center' },
  avisoTexto: { ...type.caption, color: colors.ink2, textAlign: 'center', maxWidth: 300 },
  avisoBoton: { marginTop: 6, paddingHorizontal: 18, paddingVertical: 10, borderRadius: radii.pill, backgroundColor: colors.oxRed },
  avisoBotonTexto: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13.5, color: colors.white },
});
