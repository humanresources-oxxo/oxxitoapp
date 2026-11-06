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
import { Anillo, Desplegable, Leyenda } from '../components/Visual';
import { accionDe, cargarDilos, CasoDilos, contarPor, DIA_AGENDAR_N1, diasParaSiguiente, Dilos, MATRIZ_DILOS, nivelDe, NivelDilos, porAgendar } from '../services/dilos';
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
type Filtro = 'todos' | 'agendar' | NivelDilos;
// Traffic light of the matrix, as in RH's workbook: grey on time, then green,
// yellow and red. fuerte = bar/dot, tinte = card, texto = text on the tint.
const NIVEL_COLOR: Record<NivelDilos, { fuerte: string; tinte: string; texto: string }> = {
  tiempo: { fuerte: '#9C918B', tinte: '#F2EDE9', texto: '#5E5550' },
  n1: { fuerte: colors.ok, tinte: '#E3F4EB', texto: '#1F7A4A' },
  n2: { fuerte: colors.oxGold, tinte: '#FFF4D1', texto: '#8A6100' },
  n3: { fuerte: colors.oxRed, tinte: '#FDE3E1', texto: '#B5000F' },
};

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
  const promedio = casos.length ? casos.reduce((s, c) => s + c.dias, 0) / casos.length : 0;
  const cuenta = useMemo(() => {
    const m: Record<NivelDilos, number> = { tiempo: 0, n1: 0, n2: 0, n3: 0 };
    casos.forEach((c) => (m[nivelDe(c.dias)] += 1));
    return m;
  }, [casos]);
  const agendar = casos.filter(porAgendar).length;
  const pct = (n: number) => (casos.length ? `${((n / casos.length) * 100).toLocaleString('es-MX', { maximumFractionDigits: 1 })}%` : '0%');
  // Region x level, regions with more cases first.
  const porRegion = useMemo(() => {
    const m = new Map<string, Record<NivelDilos, number>>();
    casos.forEach((c) => {
      const r = c.region || 'Sin dato';
      if (!m.has(r)) m.set(r, { tiempo: 0, n1: 0, n2: 0, n3: 0 });
      m.get(r)![nivelDe(c.dias)] += 1;
    });
    const total = (x: Record<NivelDilos, number>) => x.tiempo + x.n1 + x.n2 + x.n3;
    return [...m].map(([region, n]) => ({ region, n, total: total(n) })).sort((a, b) => b.total - a.total || a.region.localeCompare(b.region, 'es'));
  }, [casos]);
  const maxRegion = Math.max(1, ...porRegion.map((r) => r.total));
  const regiones = useMemo(() => contarPor(casos, 'region'), [casos]);

  const lista = useMemo(() => {
    const n = normalizarNombre(texto);
    return casos.filter((c: CasoDilos) => {
      if (filtro === 'agendar' ? !porAgendar(c) : filtro !== 'todos' && nivelDe(c.dias) !== filtro) return false;
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
            <Text style={styles.eyebrow}>Línea Ética · ZCS{dilos?.corte ? ` · corte ${fecha(dilos.corte)}` : ''}</Text>
            <Text style={styles.title}>Folios DILOS</Text>
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
            <Aviso titulo="No se pudieron cargar los folios" texto="Revisa tu conexión e intenta de nuevo." accion={{ texto: 'Reintentar', onPress: () => setIntento((i) => i + 1) }} />
          )}
        </View>
      ) : !dilos ? (
        <View style={styles.cargando}>
          <ActivityIndicator color={colors.oxRed} />
        </View>
      ) : !casos.length ? (
        <View style={styles.content}>
          <Aviso titulo="Sin folios abiertos" texto="RH aún no ha cargado el reporte DILOS o el último corte no trae folios." />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <LinearGradient colors={gradients.oxGrad.colors} start={gradients.oxGrad.start} end={gradients.oxGrad.end} style={styles.hero}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroKicker}>Total de folios</Text>
              <Text style={styles.heroNumero}>{casos.length}</Text>
              <Text style={styles.heroBody}>
                {promedio.toLocaleString('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} días abiertos en promedio · el más antiguo, {casos[0].dias}
              </Text>
            </View>
            <Pressable style={styles.heroLado} onPress={() => setFiltro('agendar')} accessibilityLabel={`${agendar} folios por agendar sesión de Nivel 1`}>
              <Text style={styles.heroLadoNum}>{agendar}</Text>
              <Text style={styles.heroLadoTxt}>por agendar sesión N1</Text>
              <Text style={styles.heroLadoMini}>desde el día {DIA_AGENDAR_N1}</Text>
            </Pressable>
          </LinearGradient>

          <View style={styles.kpis}>
            {MATRIZ_DILOS.map((m) => (
              <Pressable
                key={m.nivel}
                style={[styles.kpi, { backgroundColor: NIVEL_COLOR[m.nivel].tinte, borderColor: NIVEL_COLOR[m.nivel].tinte }, filtro === m.nivel && { borderColor: NIVEL_COLOR[m.nivel].fuerte }]}
                onPress={() => setFiltro(filtro === m.nivel ? 'todos' : m.nivel)}
                accessibilityRole="button"
                accessibilityLabel={`${m.nombre}: ${cuenta[m.nivel]} folios`}
              >
                <View style={styles.kpiCab}>
                  <View style={[styles.punto, { backgroundColor: NIVEL_COLOR[m.nivel].fuerte }]} />
                  <Text style={[styles.kpiTitulo, { color: NIVEL_COLOR[m.nivel].texto }]} numberOfLines={1}>
                    {m.nivel === 'tiempo' ? m.nombre : `${m.nombre} · ${m.fase}`}
                  </Text>
                </View>
                <Text style={styles.kpiValor}>{cuenta[m.nivel]}</Text>
                <Text style={styles.kpiNota}>
                  {pct(cuenta[m.nivel])} · {m.hasta === null ? `${m.desde}+ días` : `${m.desde}–${m.hasta} días`}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Folios por nivel de semáforo</Text>
            <View style={styles.anilloFila}>
              <Anillo
                segmentos={MATRIZ_DILOS.map((m) => ({ valor: cuenta[m.nivel], color: NIVEL_COLOR[m.nivel].fuerte }))}
                centro={
                  <View style={{ alignItems: 'center' }}>
                    <Text style={styles.anilloNum}>{casos.length}</Text>
                    <Text style={styles.anilloTxt}>folios</Text>
                  </View>
                }
              />
              <View style={{ flex: 1 }}>
                <Leyenda items={MATRIZ_DILOS.map((m) => ({ etiqueta: m.nombre, valor: `${cuenta[m.nivel]} · ${pct(cuenta[m.nivel])}`, color: NIVEL_COLOR[m.nivel].fuerte }))} />
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Folios por región y nivel</Text>
            <View style={{ gap: 12 }}>
              {porRegion.map((r) => (
                <View key={r.region} style={styles.regionFila}>
                  <View style={styles.regionCab}>
                    <Text style={styles.regionNombre}>{titulo(r.region)}</Text>
                    {normalizarNombre(r.region) === 'TABASCO' ? <Text style={styles.tuRegion}>TU REGIÓN</Text> : null}
                    <Text style={styles.regionTotal}>{r.total}</Text>
                  </View>
                  <View style={styles.regionPista}>
                    <View style={[styles.regionBarra, { width: `${(r.total / maxRegion) * 100}%` }]}>
                      {MATRIZ_DILOS.filter((m) => r.n[m.nivel] > 0).map((m) => (
                        <View key={m.nivel} style={{ flex: r.n[m.nivel], backgroundColor: NIVEL_COLOR[m.nivel].fuerte }} />
                      ))}
                    </View>
                  </View>
                  <Text style={styles.regionDetalle}>
                    {MATRIZ_DILOS.filter((m) => r.n[m.nivel] > 0)
                      .map((m) => `${m.nombre} ${r.n[m.nivel]}`)
                      .join(' · ')}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <Desplegable titulo="Matriz de escalamiento" icono="shield" resumen="Días, sesión y participantes de cada nivel">
            <View style={{ gap: 10 }}>
              {MATRIZ_DILOS.map((m) => (
                <View key={m.nivel} style={[styles.matriz, { backgroundColor: NIVEL_COLOR[m.nivel].tinte }]}>
                  <View style={[styles.matrizBarra, { backgroundColor: NIVEL_COLOR[m.nivel].fuerte }]} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={styles.matrizCab}>
                      <Text style={styles.matrizNivel}>
                        {m.nombre} <Text style={styles.matrizFase}>· {m.fase}</Text>
                      </Text>
                      <Text style={styles.matrizCuenta}>
                        {cuenta[m.nivel]} <Text style={styles.matrizPct}>({pct(cuenta[m.nivel])})</Text>
                      </Text>
                    </View>
                    <Text style={styles.matrizDato}>
                      <Text style={styles.matrizFuerte}>Días:</Text> {m.hasta === null ? `${m.desde} en adelante` : `${m.desde} a ${m.hasta}`}
                      {'   '}
                      <Text style={styles.matrizFuerte}>Sesión:</Text> {m.sesion === '—' ? 'no aplica' : m.sesion.toLowerCase()}
                    </Text>
                    <Text style={styles.matrizParticipantes}>{m.participantes.join(' · ')}</Text>
                  </View>
                </View>
              ))}
              <Text style={styles.nota}>Un folio en tiempo agenda su sesión de Nivel 1 desde el día {DIA_AGENDAR_N1}.</Text>
            </View>
          </Desplegable>

          <Desplegable titulo="Detalle de folios" icono="doc" inicial resumen={`${casos.length} folios · del más antiguo al más reciente`}>
            <View style={styles.chipsFila}>
              {(
                [
                  ['todos', 'Todos'],
                  ['agendar', `Por agendar · ${agendar}`],
                  ...MATRIZ_DILOS.map((m) => [m.nivel, `${m.nombre} · ${cuenta[m.nivel]}`]),
                ] as Array<[Filtro, string]>
              ).map(([k, t]) => (
                <Chip key={k} texto={t} activo={filtro === k} onPress={() => setFiltro(k)} />
              ))}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              <Chip texto="Todas las regiones" activo={!region} onPress={() => setRegion('')} />
              {regiones.map(([r, n]) => (
                <Chip key={r} texto={`${titulo(r)} · ${n}`} activo={region === r} onPress={() => setRegion(region === r ? '' : r)} />
              ))}
            </ScrollView>
            <View style={styles.buscador}>
              <Icon name="search" size={18} color={colors.ink3} />
              <TextInput
                style={styles.buscadorInput}
                value={texto}
                onChangeText={setTexto}
                placeholder="Número de folio o plaza"
                placeholderTextColor={colors.ink3}
                autoCorrect={false}
              />
            </View>
            {lista.length ? (
              lista.map((c, i) => {
                const n = nivelDe(c.dias);
                const m = MATRIZ_DILOS.find((x) => x.nivel === n)!;
                const faltan = diasParaSiguiente(c);
                const siguiente = MATRIZ_DILOS[MATRIZ_DILOS.indexOf(m) + 1];
                return (
                  <View key={c.caso} style={[styles.caso, i < lista.length - 1 && styles.linea]}>
                    <View style={[styles.casoBarra, { backgroundColor: NIVEL_COLOR[n].fuerte }]} />
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={styles.casoNum}>{c.caso}</Text>
                      <Text style={styles.casoMeta} numberOfLines={1}>
                        {titulo(c.plaza)} · {titulo(c.region)} · {c.area === 'RH' ? 'RH' : c.area === 'ADM' ? 'Administración' : c.estatus}
                      </Text>
                      <View style={styles.casoChips}>
                        <View style={[styles.nivelChip, { backgroundColor: NIVEL_COLOR[n].tinte }]}>
                          <Text style={[styles.nivelChipTxt, { color: NIVEL_COLOR[n].texto }]}>
                            {m.nombre}
                            {n === 'tiempo' ? '' : ` · ${m.fase}`}
                          </Text>
                        </View>
                        <Text style={[styles.casoAccion, porAgendar(c) && { color: colors.oxRed }]}>{accionDe(c)}</Text>
                      </View>
                    </View>
                    <View style={styles.dias}>
                      <Text style={styles.diasNum}>{c.dias}</Text>
                      <Text style={styles.diasTxt}>días</Text>
                      {faltan !== null && siguiente ? <Text style={styles.diasFalta}>{faltan === 1 ? '1 día' : `${faltan} días`} a {siguiente.nombre}</Text> : null}
                    </View>
                  </View>
                );
              })
            ) : (
              <Text style={styles.nota}>Ningún folio coincide con los filtros.</Text>
            )}
          </Desplegable>

          <Text style={styles.nota}>Reporte DILOS que carga RH. El nivel sale de los días abiertos en el portal al corte; no incluye el nombre del facilitador.</Text>
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
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpi: { flexBasis: '47%', flexGrow: 1, padding: 14, borderRadius: radii.lg, borderWidth: 1.5 },
  kpiCab: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  punto: { width: 9, height: 9, borderRadius: 5 },
  kpiTitulo: { flex: 1, fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 12 },
  kpiValor: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 30, lineHeight: 36, color: colors.ink, marginTop: 6 },
  kpiNota: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11.5, color: colors.ink2, marginTop: 1 },
  heroLadoMini: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 10.5, color: 'rgba(255,255,255,.8)', marginTop: 2, textAlign: 'center' },
  regionFila: { gap: 6 },
  regionCab: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  regionNombre: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 14, color: colors.ink },
  tuRegion: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 10, color: colors.oxRed, letterSpacing: 0.6 },
  regionTotal: { marginLeft: 'auto', fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 16, color: colors.ink },
  regionPista: { height: 12, borderRadius: 6, backgroundColor: colors.field, overflow: 'hidden' },
  regionBarra: { height: 12, flexDirection: 'row', borderRadius: 6, overflow: 'hidden' },
  regionDetalle: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11.5, color: colors.ink2 },
  matriz: { flexDirection: 'row', gap: 12, padding: 12, borderRadius: radii.md },
  matrizBarra: { width: 5, borderRadius: 3 },
  matrizCab: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  matrizNivel: { flex: 1, fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 15, color: colors.ink },
  matrizFase: { fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.ink2 },
  matrizCuenta: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 16, color: colors.ink },
  matrizPct: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: colors.ink2 },
  matrizDato: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12.5, color: colors.ink2 },
  matrizFuerte: { fontFamily: 'PlusJakartaSans_800ExtraBold', color: colors.ink },
  matrizParticipantes: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, lineHeight: 17, color: colors.ink2 },
  casoChips: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  nivelChip: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: radii.pill },
  nivelChipTxt: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 11.5 },
  casoAccion: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11.5, color: colors.ink2 },
  diasFalta: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 10.5, color: colors.ink3, textAlign: 'center', marginTop: 2, maxWidth: 82 },
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
