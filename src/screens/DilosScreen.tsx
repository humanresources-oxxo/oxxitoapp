// src/screens/DilosScreen.tsx
// Casos DILOS, app only: open cases of the Zona Centro Sur at the report's
// cut: who is handling them (ring RH / ADM), how long they have been open
// (stacked bar), and, folded, by región and plaza and the list of cases.
// No names: the facilitator never reaches the app (services/dilos.ts).
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { PinUnaVez } from '../components/PinUnaVez';
import { getJson, storageKeys } from '../services/appStorage';
import { esSinSesion } from '../services/sesion';
import { Anillo, BarraApilada, Barras, Desplegable, Leyenda } from '../components/Visual';
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
  // The Apps Script didn't accept the session key: confirm the PIN once.
  const [sinSesion, setSinSesion] = useState(false);
  const [pedirPin, setPedirPin] = useState(false);
  // PIN already confirmed in this screen: if the server still rejects the
  // session, the problem is on its side (it couldn't check it), not the PIN.
  const [pinConfirmado, setPinConfirmado] = useState(false);
  const [numero, setNumero] = useState('');
  const [intento, setIntento] = useState(0);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [region, setRegion] = useState('');
  const [texto, setTexto] = useState('');

  useEffect(() => {
    getJson<{ numeroEmpleado?: string } | null>(storageKeys.session, null).then((x) => setNumero(x?.numeroEmpleado ?? ''));
  }, []);

  useEffect(() => {
    let activo = true;
    setDilos(null);
    setError(false);
    setSinSesion(false);
    cargarDilos()
      .then((d) => activo && setDilos(d))
      .catch((e) => {
        if (!activo) return;
        setSinSesion(esSinSesion(e));
        setError(true);
      });
    return () => {
      activo = false;
    };
  }, [intento]);

  const casos = dilos?.casos || [];
  const rh = casos.filter((c) => c.area === 'RH').length;
  const adm = casos.filter((c) => c.area === 'ADM').length;
  const otra = casos.length - rh - adm;
  const promedio = casos.length ? casos.reduce((s, c) => s + c.dias, 0) / casos.length : 0;
  // Aging buckets: on time, delayed, very delayed.
  const enTiempo = casos.filter((c) => c.dias <= DIAS_ALERTA).length;
  const muyAtrasados = casos.filter((c) => c.dias > DIAS_ALERTA + 5).length;
  const atrasados = casos.length - enTiempo - muyAtrasados;
  const regiones = useMemo(() => contarPor(casos, 'region'), [casos]);
  const plazas = useMemo(() => contarPor(casos, 'plaza'), [casos]);
  const tabasco = casos.filter((c) => normalizarNombre(c.region) === 'TABASCO').length;
  const pct = (n: number) => (casos.length ? `${Math.round((n / casos.length) * 100)}%` : '0%');

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
          {sinSesion && pinConfirmado ? (
            <Aviso
              titulo="No pudimos verificar tu sesión"
              texto="Tu PIN es correcto, pero el servidor no pudo confirmar tu sesión. Avisa a RH o a Soporte de la App e intenta más tarde."
              accion={{ texto: 'Reintentar', onPress: () => setIntento((i) => i + 1) }}
            />
          ) : sinSesion ? (
            <Aviso titulo="Confirma tu PIN" texto="Para ver esta información, confirma tu PIN una vez." accion={{ texto: 'Confirmar PIN', onPress: () => setPedirPin(true) }} />
          ) : (
            <Aviso titulo="No se pudieron cargar los casos" texto="Revisa tu conexión e intenta de nuevo." accion={{ texto: 'Reintentar', onPress: () => setIntento((i) => i + 1) }} />
          )}
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
              <Text style={styles.heroBody}>{promedio.toLocaleString('es-MX', { maximumFractionDigits: 0 })} días en promedio</Text>
            </View>
            <View style={styles.heroLado}>
              <Text style={styles.heroLadoNum}>{casos[0].dias}</Text>
              <Text style={styles.heroLadoTxt}>días el más antiguo</Text>
            </View>
          </LinearGradient>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>¿Quién los atiende?</Text>
            <View style={styles.anilloFila}>
              <Anillo
                segmentos={[
                  { valor: rh, color: colors.oxBlue },
                  { valor: adm, color: colors.oxGold },
                  { valor: otra, color: colors.ink3 },
                ]}
                centro={
                  <View style={{ alignItems: 'center' }}>
                    <Text style={styles.anilloNum}>{casos.length}</Text>
                    <Text style={styles.anilloTxt}>casos</Text>
                  </View>
                }
              />
              <View style={{ flex: 1 }}>
                <Leyenda
                  items={[
                    { etiqueta: 'Recursos Humanos', valor: `${rh} · ${pct(rh)}`, color: colors.oxBlue },
                    { etiqueta: 'Administración', valor: `${adm} · ${pct(adm)}`, color: colors.oxGold },
                    ...(otra ? [{ etiqueta: 'Otra área', valor: String(otra), color: colors.ink3 }] : []),
                  ]}
                />
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>¿Cuánto llevan abiertos?</Text>
            <BarraApilada
              segmentos={[
                { etiqueta: `Hasta ${DIAS_ALERTA} días`, valor: enTiempo, color: colors.ok },
                { etiqueta: `${DIAS_ALERTA + 1} a ${DIAS_ALERTA + 5} días`, valor: atrasados, color: colors.oxGold },
                { etiqueta: `Más de ${DIAS_ALERTA + 5} días`, valor: muyAtrasados, color: colors.oxRed },
              ]}
            />
          </View>

          <View style={[styles.card, styles.oaxaca]}>
            <Icon name="pin" size={20} color={colors.oxRed} />
            <Text style={styles.oaxacaTexto}>
              {tabasco ? (
                <>
                  <Text style={styles.oaxacaFuerte}>{tabasco === 1 ? '1 caso' : `${tabasco} casos`}</Text> en la región Tabasco, la de Plaza Oaxaca
                </>
              ) : (
                'Sin casos en la región Tabasco, la de Plaza Oaxaca'
              )}
            </Text>
          </View>

          <Desplegable
            titulo="Por región y plaza"
            icono="pin"
            resumen={plazas.length ? `${titulo(plazas[0][0])} tiene más casos (${plazas[0][1]}) · ${regiones.length} regiones` : undefined}
          >
            <Text style={styles.subTitulo}>Regiones</Text>
            <Barras filas={regiones.map(([r, n]) => ({ etiqueta: titulo(r), valor: n }))} formato={(v) => String(v)} destacar="Tabasco" />
            <Text style={[styles.subTitulo, { marginTop: 6 }]}>Plazas</Text>
            <Barras filas={plazas.map(([p, n]) => ({ etiqueta: titulo(p), valor: n }))} formato={(v) => String(v)} maxFilas={5} />
          </Desplegable>

          <Desplegable titulo="Lista de casos" icono="doc" resumen={`${casos.length} casos · del más antiguo al más reciente`}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              <Chip texto="Todas" activo={!region} onPress={() => setRegion('')} />
              {regiones.map(([r, n]) => (
                <Chip key={r} texto={`${titulo(r)} · ${n}`} activo={region === r} onPress={() => setRegion(region === r ? '' : r)} />
              ))}
            </ScrollView>
            <View style={styles.chipsFila}>
              {(
                [
                  ['todos', 'Todos'],
                  ['RH', 'RH'],
                  ['ADM', 'ADM'],
                  ['atrasados', `+${DIAS_ALERTA} días`],
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
            {lista.length ? (
              lista.map((c, i) => (
                <View key={c.caso} style={[styles.caso, i < lista.length - 1 && styles.linea]}>
                  <View style={[styles.casoBarra, { backgroundColor: c.dias > DIAS_ALERTA + 5 ? colors.oxRed : c.dias > DIAS_ALERTA ? colors.oxGold : colors.ok }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.casoNum}>{c.caso}</Text>
                    <Text style={styles.casoMeta} numberOfLines={1}>
                      {titulo(c.plaza)} · {c.area === 'RH' ? 'RH' : c.area === 'ADM' ? 'Administración' : c.estatus}
                    </Text>
                  </View>
                  <Text style={styles.casoDias}>{c.dias} d</Text>
                </View>
              ))
            ) : (
              <Text style={styles.nota}>Ningún caso coincide con los filtros.</Text>
            )}
          </Desplegable>

          <Text style={styles.nota}>Reporte DILOS que carga RH. No incluye el nombre del facilitador; los días son los abiertos al corte.</Text>
        </ScrollView>
      )}
      {pedirPin ? (
        <PinUnaVez
          numero={numero}
          onCerrar={() => setPedirPin(false)}
          onListo={() => {
            setPedirPin(false);
            setPinConfirmado(true);
            setIntento((n) => n + 1);
          }}
        />
      ) : null}
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
  anilloFila: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  anilloNum: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 26, color: colors.ink },
  anilloTxt: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: colors.ink3, marginTop: -2 },
  oaxaca: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  oaxacaTexto: { flex: 1, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13.5, lineHeight: 19, color: colors.ink2 },
  oaxacaFuerte: { fontFamily: 'PlusJakartaSans_800ExtraBold', color: colors.ink },
  subTitulo: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 12, color: colors.ink3, textTransform: 'uppercase', letterSpacing: 0.8 },
  linea: { borderBottomWidth: 1, borderBottomColor: colors.line },
  casoBarra: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  casoDias: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 15, color: colors.ink },
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
  caso: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
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
