// src/screens/DilosScreen.tsx
// Casos DILOS, app only: open cases of the Zona Centro Sur at the report's
// cut: how many there are per level of the escalation matrix, a table by
// plaza (folios, average and oldest days, and folios per level, like the
// dashboards' "Vacantes por Asesor") and the list of cases.
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
import { accionDe, cargarDilos, CasoDilos, contarPor, DIA_AGENDAR_N1, DIAS_ALERTA_ESCALAR, diasParaSiguiente, Dilos, MATRIZ_DILOS, nivelDe, NivelDilos, porAgendar, porEscalar } from '../services/dilos';
import { normalizarNombre } from '../services/gviz';
import { colors, gradients, radii, shadows, type } from '../theme/tokens';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function fecha(iso?: string) {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${+m[3]} ${MESES[+m[2] - 1]} ${m[1]}` : '';
}
// "ACAPULCO" -> "Acapulco"; acronyms like CDMX stay as they are.
const SIGLAS = new Set(['CDMX', 'EDOMEX']);
// "PLAYA DEL CARMEN" -> "Playa del Carmen".
const MENORES = new Set(['DE', 'DEL', 'LA', 'LAS', 'LOS', 'Y']);
const titulo = (s: string) =>
  s
    .split(' ')
    .map((w, i) =>
      SIGLAS.has(w.toUpperCase()) ? w.toUpperCase() : i > 0 && MENORES.has(w.toUpperCase()) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    )
    .join(' ');
type Filtro = 'todos' | 'agendar' | 'escalar' | NivelDilos;
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
  const [plaza, setPlaza] = useState('');
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
  // About to move up a level (RH's workbook: "Alerta si faltan 3 días"), closest first.
  const escalar = useMemo(() => casos.filter(porEscalar).sort((a, b) => (diasParaSiguiente(a) ?? 0) - (diasParaSiguiente(b) ?? 0)), [casos]);
  const pct = (n: number) => (casos.length ? `${((n / casos.length) * 100).toLocaleString('es-MX', { maximumFractionDigits: 1 })}%` : '0%');
  const regiones = useMemo(() => contarPor(casos, 'region'), [casos]);

  const lista = useMemo(() => {
    const n = normalizarNombre(texto);
    return casos.filter((c: CasoDilos) => {
      if (filtro === 'agendar' ? !porAgendar(c) : filtro === 'escalar' ? !porEscalar(c) : filtro !== 'todos' && nivelDe(c.dias) !== filtro) return false;
      if (region && c.region !== region) return false;
      if (plaza && c.plaza !== plaza) return false;
      return !n || normalizarNombre(`${c.caso} ${c.plaza} ${c.region}`).includes(n);
    });
  }, [casos, filtro, region, plaza, texto]);

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
              Línea Ética · ZCS{dilos?.corte ? ` · corte ${fecha(dilos.corte)}` : dilos?.cargadoEl ? ` · cargado ${fecha(dilos.cargadoEl)}` : ''}
            </Text>
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

          {escalar.length ? (
            <Pressable
              style={[styles.alerta, filtro === 'escalar' && styles.alertaActiva]}
              onPress={() => setFiltro(filtro === 'escalar' ? 'todos' : 'escalar')}
              accessibilityRole="button"
              accessibilityLabel={`${escalar.length} folios suben de nivel en ${DIAS_ALERTA_ESCALAR} días o menos. Ver en el detalle`}
            >
              <Icon name="alert" size={20} color={colors.oxRed} />
              <View style={{ flex: 1 }}>
                <Text style={styles.alertaTitulo}>
                  {escalar.length === 1 ? '1 folio sube' : `${escalar.length} folios suben`} de nivel en {DIAS_ALERTA_ESCALAR} días o menos
                </Text>
                <Text style={styles.alertaTexto} numberOfLines={2}>
                  {escalar
                    .slice(0, 3)
                    .map((c) => {
                      const faltan = diasParaSiguiente(c) ?? 0;
                      const sig = MATRIZ_DILOS[MATRIZ_DILOS.findIndex((m) => m.nivel === nivelDe(c.dias)) + 1];
                      return `${titulo(c.plaza)}: ${faltan === 0 ? 'hoy' : faltan === 1 ? '1 día' : `${faltan} días`} a ${sig.nombre}`;
                    })
                    .join(' · ')}
                  {escalar.length > 3 ? ` · y ${escalar.length - 3} más` : ''}
                </Text>
              </View>
              <Icon name="chevR" size={18} color={colors.oxRed} />
            </Pressable>
          ) : null}

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

          <TablaPlazas
            casos={casos}
            plaza={plaza}
            onPlaza={(p) => {
              setPlaza(p === plaza ? '' : p);
              setRegion('');
            }}
          />

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
                  ['escalar', `Por escalar · ${escalar.length}`],
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
            {plaza ? (
              <Pressable style={styles.plazaFiltro} onPress={() => setPlaza('')} accessibilityRole="button" accessibilityLabel={`Quitar el filtro de plaza ${titulo(plaza)}`}>
                <Text style={styles.plazaFiltroTxt}>Plaza: {titulo(plaza)}</Text>
                <Icon name="close" size={14} color={colors.oxRed} />
              </Pressable>
            ) : null}
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
                      {faltan !== null && siguiente ? (
                        <Text style={[styles.diasFalta, faltan <= DIAS_ALERTA_ESCALAR && styles.diasFaltaAlerta]}>
                          {faltan === 1 ? '1 día' : `${faltan} días`} a {siguiente.nombre}
                        </Text>
                      ) : null}
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

// "Folios por Plaza", like the dashboards' "Vacantes por Asesor": the Plaza
// column stays put and the rest slides sideways on a phone. Tapping a header
// sorts by it (again, the other way); tapping a plaza filters the list below.
type ColPlaza = 'plaza' | 'folios' | 'prom' | 'max' | NivelDilos;
type FilaPlaza = { plaza: string; region: string; folios: number; prom: number; max: number; peor: NivelDilos } & Record<NivelDilos, number>;
const COLS: Array<{ col: Exclude<ColPlaza, 'plaza'>; titulo: string; ancho: number }> = [
  { col: 'folios', titulo: 'Folios', ancho: 108 },
  { col: 'prom', titulo: 'Días prom.', ancho: 100 },
  { col: 'max', titulo: 'Días máx.', ancho: 92 },
  { col: 'tiempo', titulo: 'En tiempo', ancho: 92 },
  { col: 'n1', titulo: 'N1', ancho: 52 },
  { col: 'n2', titulo: 'N2', ancho: 52 },
  { col: 'n3', titulo: 'N3', ancho: 52 },
];
const ORDEN_NIVEL: NivelDilos[] = ['tiempo', 'n1', 'n2', 'n3'];
const ALTO_CAB = 40;
const ALTO_FILA = 52;
const ALTO_TOTAL = 46;
const ANCHO_PLAZA = 160;
const decimal = (n: number) => n.toLocaleString('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function TablaPlazas({ casos, plaza, onPlaza }: { casos: CasoDilos[]; plaza: string; onPlaza: (p: string) => void }) {
  const [orden, setOrden] = useState<{ col: ColPlaza; desc: boolean }>({ col: 'folios', desc: true });
  const filas = useMemo(() => {
    const m = new Map<string, FilaPlaza & { suma: number }>();
    casos.forEach((c) => {
      const k = c.plaza || 'Sin dato';
      const f = m.get(k) || { plaza: k, region: c.region, folios: 0, prom: 0, max: 0, suma: 0, peor: 'tiempo' as NivelDilos, tiempo: 0, n1: 0, n2: 0, n3: 0 };
      const n = nivelDe(c.dias);
      f.folios += 1;
      f.suma += c.dias;
      f.max = Math.max(f.max, c.dias);
      f[n] += 1;
      if (ORDEN_NIVEL.indexOf(n) > ORDEN_NIVEL.indexOf(f.peor)) f.peor = n;
      m.set(k, f);
    });
    const lista = [...m.values()].map((f) => ({ ...f, prom: f.suma / f.folios }));
    const signo = orden.desc ? -1 : 1;
    return lista.sort((a, b) =>
      orden.col === 'plaza'
        ? signo * b.plaza.localeCompare(a.plaza, 'es')
        : signo * (a[orden.col] - b[orden.col]) || b.folios - a.folios || a.plaza.localeCompare(b.plaza, 'es')
    );
  }, [casos, orden]);
  const maxFolios = Math.max(1, ...filas.map((f) => f.folios));
  const total = useMemo(() => {
    const t: Record<NivelDilos, number> = { tiempo: 0, n1: 0, n2: 0, n3: 0 };
    casos.forEach((c) => (t[nivelDe(c.dias)] += 1));
    return { ...t, folios: casos.length, prom: casos.length ? casos.reduce((s, c) => s + c.dias, 0) / casos.length : 0, max: Math.max(0, ...casos.map((c) => c.dias)) };
  }, [casos]);
  const ordenar = (col: ColPlaza) => setOrden((o) => (o.col === col ? { col, desc: !o.desc } : { col, desc: col !== 'plaza' }));
  const flecha = (col: ColPlaza) => (orden.col === col ? (orden.desc ? ' ↓' : ' ↑') : ' ⇅');
  const cabecera = (col: ColPlaza, texto: string, ancho?: number, izquierda?: boolean) => (
    <Pressable
      key={col}
      style={[styles.tCab, ancho ? { width: ancho } : { flex: 1 }, izquierda ? { alignItems: 'flex-start', paddingLeft: 12 } : null]}
      onPress={() => ordenar(col)}
      accessibilityRole="button"
      accessibilityLabel={`Ordenar por ${texto}`}
    >
      <Text style={[styles.tCabTxt, orden.col === col && { color: colors.oxRed }]} numberOfLines={1}>
        {texto}
        <Text style={styles.tFlecha}>{flecha(col)}</Text>
      </Text>
    </Pressable>
  );
  const pastilla = (nivel: NivelDilos, n: number) =>
    n ? (
      <View style={[styles.tPastilla, { backgroundColor: NIVEL_COLOR[nivel].tinte }]}>
        <Text style={[styles.tPastillaTxt, { color: NIVEL_COLOR[nivel].texto }]}>{n}</Text>
      </View>
    ) : (
      <Text style={styles.tGuion}>–</Text>
    );
  const celda = (f: FilaPlaza, col: Exclude<ColPlaza, 'plaza'>) => {
    if (col === 'folios')
      return (
        <View style={styles.tFolios}>
          <Text style={styles.tFoliosNum}>{f.folios}</Text>
          <View style={styles.tPista}>
            <View style={[styles.tBarra, { width: `${(f.folios / maxFolios) * 100}%`, backgroundColor: NIVEL_COLOR[f.peor].fuerte }]} />
          </View>
        </View>
      );
    if (col === 'prom') return <Text style={styles.tNum}>{decimal(f.prom)}</Text>;
    if (col === 'max') return <Text style={styles.tNum}>{f.max}</Text>;
    return pastilla(col, f[col]);
  };

  return (
    <View style={[styles.card, { paddingHorizontal: 0, paddingBottom: 0, overflow: 'hidden' }]}>
      <View style={styles.tTitulo}>
        <Text style={[styles.cardTitle, { marginBottom: 0, flexShrink: 1 }]}>Folios por Plaza</Text>
        <Text style={styles.tBadge} numberOfLines={1}>
          {filas.length} {filas.length === 1 ? 'plaza' : 'plazas'} · ZCS
        </Text>
      </View>
      <View style={{ flexDirection: 'row' }}>
        {/* Columna fija: plaza */}
        <View style={[styles.tFija, { width: ANCHO_PLAZA }]}>
          <View style={[styles.tFilaCab, { height: ALTO_CAB }]}>{cabecera('plaza', 'Plaza', ANCHO_PLAZA, true)}</View>
          {filas.map((f, i) => (
            <Pressable
              key={f.plaza}
              style={[styles.tPlaza, { height: ALTO_FILA }, i % 2 === 1 && styles.tAlterna, plaza === f.plaza && styles.tElegida]}
              onPress={() => onPlaza(f.plaza)}
              accessibilityRole="button"
              accessibilityState={{ selected: plaza === f.plaza }}
              accessibilityLabel={`${titulo(f.plaza)}: ${f.folios} folios. Ver sus folios`}
            >
              <View style={[styles.punto, { backgroundColor: NIVEL_COLOR[f.peor].fuerte }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.tPlazaTxt, plaza === f.plaza && { color: colors.oxRed }]} numberOfLines={1}>
                  {titulo(f.plaza)}
                </Text>
                <Text style={[styles.tRegionTxt, normalizarNombre(f.plaza) === 'OAXACA' && { color: colors.oxRed }]} numberOfLines={1}>
                  {normalizarNombre(f.plaza) === 'OAXACA' ? 'TU PLAZA' : titulo(f.region)}
                </Text>
              </View>
            </Pressable>
          ))}
          <View style={[styles.tTotal, { height: ALTO_TOTAL, paddingLeft: 12, alignItems: 'flex-start' }]}>
            <Text style={styles.tTotalTxt}>Total general</Text>
          </View>
        </View>
        {/* Lo demás se desliza de lado */}
        <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ flexGrow: 1 }}>
          <View style={{ flexGrow: 1 }}>
            <View style={[styles.tFilaCab, { height: ALTO_CAB }]}>{COLS.map((c) => cabecera(c.col, c.titulo, c.ancho))}</View>
            {filas.map((f, i) => (
              <Pressable
                key={f.plaza}
                style={[styles.tFila, { height: ALTO_FILA }, i % 2 === 1 && styles.tAlterna, plaza === f.plaza && styles.tElegida]}
                onPress={() => onPlaza(f.plaza)}
                accessible={false}
              >
                {COLS.map((c) => (
                  <View key={c.col} style={[styles.tCelda, { width: c.ancho }]}>
                    {celda(f, c.col)}
                  </View>
                ))}
              </Pressable>
            ))}
            <View style={[styles.tFila, styles.tTotal, { height: ALTO_TOTAL }]}>
              {COLS.map((c) => (
                <View key={c.col} style={[styles.tCelda, { width: c.ancho }]}>
                  <Text style={styles.tTotalTxt}>
                    {c.col === 'prom' ? decimal(total.prom) : String(total[c.col])}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
      <Text style={styles.tNota}>Desliza la tabla para ver los niveles. Toca una plaza para ver sus folios abajo; el punto marca su folio más grave.</Text>
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
  diasFaltaAlerta: { fontFamily: 'PlusJakartaSans_800ExtraBold', color: colors.oxRed },
  alerta: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radii.xl, backgroundColor: '#FFF0EC', borderWidth: 1, borderColor: '#FFD2C4' },
  alertaActiva: { borderColor: colors.oxRed, borderWidth: 2 },
  alertaTitulo: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 14, color: colors.ink },
  alertaTexto: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12.5, lineHeight: 17, color: colors.ink2, marginTop: 2 },
  diasFalta: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 10.5, color: colors.ink3, textAlign: 'center', marginTop: 2, maxWidth: 82 },
  barraFila: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
  barraEtq: { width: 96, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12.5, color: colors.ink2 },
  barraFondo: { flex: 1, height: 9, borderRadius: 5, backgroundColor: colors.field, overflow: 'hidden' },
  barraLlena: { height: 9, borderRadius: 5, backgroundColor: colors.oxRed },
  barraValor: { width: 26, textAlign: 'right', fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12.5, color: colors.ink },
  chips: { flexDirection: 'row', gap: 8 },
  chipsFila: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tTitulo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 16, marginBottom: 12 },
  tBadge: { flexShrink: 0, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11.5, color: colors.ink2, backgroundColor: colors.field, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radii.pill, overflow: 'hidden' },
  tFija: { borderRightWidth: 1, borderRightColor: colors.line, backgroundColor: colors.white, zIndex: 1 },
  tFilaCab: { flexDirection: 'row', backgroundColor: '#F7F1EC', borderBottomWidth: 1, borderBottomColor: colors.line },
  tCab: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
  tCabTxt: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 10.5, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.ink2 },
  tFlecha: { color: colors.ink3, fontSize: 10 },
  tPlaza: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 12, paddingRight: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  tPlazaTxt: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: colors.ink },
  tRegionTxt: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10, letterSpacing: 0.3, color: colors.ink3, marginTop: 1 },
  tFila: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.line },
  tAlterna: { backgroundColor: '#FCF9F6' },
  tElegida: { backgroundColor: '#FFF0EC' },
  tCelda: { justifyContent: 'center', alignItems: 'center' },
  tFolios: { flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%', paddingHorizontal: 10 },
  tFoliosNum: { minWidth: 18, textAlign: 'right', fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 15, color: colors.ink },
  tPista: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.field, overflow: 'hidden' },
  tBarra: { height: 8, borderRadius: 4 },
  tNum: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: colors.ink },
  tPastilla: { minWidth: 26, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7, alignItems: 'center' },
  tPastillaTxt: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 12.5 },
  tGuion: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: colors.ink3 },
  tTotal: { justifyContent: 'center', backgroundColor: '#F7F1EC', borderTopWidth: 2, borderTopColor: colors.ink, borderBottomWidth: 0 },
  tTotalTxt: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 13, color: colors.ink },
  tNota: { ...type.caption, color: colors.ink3, paddingHorizontal: 16, paddingVertical: 12 },
  plazaFiltro: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.pill, backgroundColor: '#FFF0EC', borderWidth: 1, borderColor: colors.oxRed },
  plazaFiltroTxt: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 13, color: colors.oxRed },
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
