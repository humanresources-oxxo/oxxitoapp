// src/screens/CctScreen.tsx
// Contratos colectivos (CCT), app only: Plaza Oaxaca's contract (current
// revision, consulta, legitimación, prestaciones, document compliance and its
// history) and how its raise compares with the other OXXO plazas of the year.
// Data uploaded by RH from the admin panel (services/cct.ts).
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { aumento, cargarCct, Cct, CctDatos, esOaxaca, promedio } from '../services/cct';
import { normalizarNombre } from '../services/gviz';
import { colors, gradients, radii, shadows, type } from '../theme/tokens';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function fecha(iso?: string) {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${+m[3]} ${MESES[+m[2] - 1]} ${m[1]}` : '—';
}
const pct = (f?: number | null, dec = 1) => (typeof f === 'number' ? `${(f * 100).toLocaleString('es-MX', { maximumFractionDigits: dec })}%` : '—');
const num = (n?: number | null) => (typeof n === 'number' ? n.toLocaleString('es-MX') : '—');
const dinero = (n?: number | null) => (typeof n === 'number' ? `$${n.toLocaleString('es-MX', { maximumFractionDigits: 2 })}` : '—');
function diasVsVencimiento(d?: number) {
  if (typeof d !== 'number') return '';
  if (d === 0) return 'el día del vencimiento';
  return `${Math.abs(d)} ${Math.abs(d) === 1 ? 'día' : 'días'} ${d < 0 ? 'antes' : 'después'} del vencimiento`;
}

export function CctScreen({ onBack }: { onBack: () => void }) {
  const [cct, setCct] = useState<Cct | null>(null);
  const [error, setError] = useState(false);
  const [intento, setIntento] = useState(0);
  const [texto, setTexto] = useState('');

  useEffect(() => {
    let activo = true;
    setCct(null);
    setError(false);
    cargarCct()
      .then((c) => activo && setCct(c))
      .catch(() => activo && setError(true));
    return () => {
      activo = false;
    };
  }, [intento]);

  // The ejercicio sheet (current year) when it has Oaxaca; else the latest historical row.
  const anio = useMemo(() => Math.max(0, ...(cct?.ejercicio || []).map((d) => d.anio || 0)), [cct]);
  const actual = cct?.ejercicio.find(esOaxaca);
  const historial = useMemo(
    () => (cct?.historico || []).filter(esOaxaca).sort((a, b) => (b.anio || 0) - (a.anio || 0)),
    [cct]
  );
  const ficha: { d: CctDatos; hoja: 'historico' | 'ejercicio' } | null = actual
    ? { d: actual, hoja: 'ejercicio' }
    : historial[0]
      ? { d: historial[0], hoja: 'historico' }
      : null;

  // National comparison on the ejercicio sheet (one row per plaza).
  const plazas = cct?.ejercicio || [];
  const subidaOax = actual ? aumento(actual, 'ejercicio') : undefined;
  const promNacional = promedio(plazas.map((d) => d.pctSalarioNominal));
  const delCluster = plazas.filter((d) => actual && d.cluster === actual.cluster);
  const promCluster = promedio(delCluster.map((d) => d.pctSalarioNominal));
  const ordenadas = [...plazas].filter((d) => typeof d.pctSalarioNominal === 'number').sort((a, b) => (b.pctSalarioNominal || 0) - (a.pctSalarioNominal || 0));
  const mayores = typeof subidaOax === 'number' ? ordenadas.filter((d) => (d.pctSalarioNominal || 0) > subidaOax).length : 0;
  const empates = typeof subidaOax === 'number' ? ordenadas.filter((d) => d !== actual && d.pctSalarioNominal === subidaOax).length : 0;
  const distribucion = useMemo(() => {
    const m = new Map<string, number>();
    plazas.forEach((d) => {
      const k = pct(d.pctSalarioNominal);
      m.set(k, (m.get(k) || 0) + 1);
    });
    return [...m].sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]));
  }, [plazas]);
  const maxDist = Math.max(1, ...distribucion.map(([, n]) => n));
  const sindicatos = useMemo(() => {
    const m = new Map<string, number>();
    plazas.forEach((d) => m.set(d.sindicato || 'Sin dato', (m.get(d.sindicato || 'Sin dato') || 0) + 1));
    return [...m].sort((a, b) => b[1] - a[1]);
  }, [plazas]);
  const lista = useMemo(() => {
    const n = normalizarNombre(texto);
    return ordenadas.filter((d) => !n || normalizarNombre(`${d.plaza} ${d.entidad} ${d.cluster} ${d.sindicato}`).includes(n));
  }, [ordenadas, texto]);

  const cargado = cct?.cargadoEl ? fecha(cct.cargadoEl.slice(0, 10)) : '';

  return (
    <View style={styles.screen}>
      <LinearGradient colors={['#FFF7F0', colors.bg, '#FFFFFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={styles.header}>
          <Pressable style={styles.headerButton} onPress={onBack} accessibilityLabel="Regresar">
            <Icon name="chevL" size={20} color={colors.ink} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>Plaza Oaxaca{cargado ? ` · cargado ${cargado}` : ''}</Text>
            <Text style={styles.title}>Contratos colectivos</Text>
          </View>
        </View>
      </SafeAreaView>

      {error ? (
        <View style={styles.content}>
          <Aviso titulo="No se pudieron cargar los contratos" texto="Revisa tu conexión e intenta de nuevo." accion={{ texto: 'Reintentar', onPress: () => setIntento((i) => i + 1) }} />
        </View>
      ) : !cct ? (
        <View style={styles.cargando}>
          <ActivityIndicator color={colors.oxRed} />
        </View>
      ) : !ficha ? (
        <View style={styles.content}>
          <Aviso titulo="Todavía no hay datos" texto="RH aún no ha cargado el Excel de contratos colectivos en el panel admin." />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <LinearGradient colors={gradients.oxGrad.colors} start={gradients.oxGrad.start} end={gradients.oxGrad.end} style={styles.hero}>
            <Text style={styles.heroKicker}>
              Revisión {ficha.d.anio} · {ficha.d.tipoRevision || 'sin tipo'}
            </Text>
            <Text style={styles.heroNumero}>+{pct(aumento(ficha.d, ficha.hoja))}</Text>
            <Text style={styles.heroBody}>aumento salarial nominal</Text>
            <Text style={styles.heroMeta}>
              {ficha.d.estatusRevision || 'Sin estatus'}
              {ficha.d.fechaRevision ? ` el ${fecha(ficha.d.fechaRevision)}` : ''}
              {ficha.d.diasRevision !== undefined ? ` · ${diasVsVencimiento(ficha.d.diasRevision)} (${fecha(ficha.d.vencimiento)})` : ''}
            </Text>
          </LinearGradient>

          {typeof subidaOax === 'number' && promNacional !== null ? (
            <View style={styles.fila}>
              <Dato titulo="Promedio nacional" valor={pct(promNacional, 2)} nota={`${plazas.length} plazas`} />
              <Dato titulo={`Promedio ${actual?.cluster || 'cluster'}`} valor={pct(promCluster, 2)} nota={`${delCluster.length} plazas`} />
              <Dato
                titulo="Lugar"
                valor={`${mayores + 1}º de ${ordenadas.length}`}
                nota={empates ? `empata con ${empates} plazas` : mayores ? `${mayores} subieron más` : 'el aumento más alto'}
              />
            </View>
          ) : null}

          <Tarjeta titulo="Contrato">
            <Fila etq="Sindicato" valor={ficha.d.sindicato} />
            <Fila etq="Expediente" valor={ficha.d.expediente} />
            <Fila etq="Plantilla (HC)" valor={num(ficha.d.hc)} />
            <Fila etq="Centros de trabajo" valor={num(ficha.d.cts)} />
            <Fila etq="Zona salarial" valor={ficha.d.zona} />
            <Fila etq="Vencimiento" valor={fecha(ficha.d.vencimiento)} />
            {ficha.hoja === 'ejercicio' ? <Fila etq="% Salario (columna del Excel)" valor={pct(ficha.d.pctSalario)} /> : null}
            <Fila etq="% Prestaciones" valor={pct(ficha.d.pctPrestaciones)} ultimo />
          </Tarjeta>

          <Tarjeta titulo="Legitimación y consulta">
            <Fila etq="Forma de creación" valor={ficha.d.formaCreacion} />
            <Fila etq="Año de legitimación" valor={ficha.d.anioLegitimacion ? `${ficha.d.anioLegitimacion}${ficha.d.antiguedad ? ` (${ficha.d.antiguedad} años)` : ''}` : '—'} />
            <Fila etq="Participación / aprobación (leg.)" valor={`${pct(ficha.d.participacionLeg)} / ${pct(ficha.d.aprobacionLeg)}`} />
            <Fila etq="Consulta" valor={ficha.d.estatusConsulta ? `${ficha.d.estatusConsulta}${ficha.d.fechaConsulta ? ` · ${fecha(ficha.d.fechaConsulta)}` : ''}` : 'No aplica este año'} />
            {ficha.d.participacion !== undefined ? <Fila etq="Participación / aprobación (consulta)" valor={`${pct(ficha.d.participacion)} / ${pct(ficha.d.aprobacion)}`} /> : null}
            <View style={{ height: 1 }} />
          </Tarjeta>

          <Tarjeta titulo="Prestaciones">
            <Fila etq="Salario base / promedio" valor={`${dinero(ficha.d.salarioBase)} / ${dinero(ficha.d.salarioPromedio)}`} />
            <Fila etq="Vales de despensa" valor={ficha.d.valesMax && ficha.d.valesMax !== ficha.d.valesMin ? `${dinero(ficha.d.valesMin)} – ${dinero(ficha.d.valesMax)}` : dinero(ficha.d.valesMin)} />
            <Fila etq="Aguinaldo" valor={ficha.d.aguinaldoDias ? `${ficha.d.aguinaldoDias} días` : '—'} />
            <Fila etq="Prima vacacional / dominical" valor={`${pct(ficha.d.primaVacacional, 0)} / ${pct(ficha.d.primaDominical, 0)}`} />
            <Fila etq="Fondo de ahorro" valor={ficha.d.fondoAhorro && ficha.d.fondoAhorro !== '0' ? ficha.d.fondoAhorro : 'No'} ultimo />
          </Tarjeta>

          {ficha.hoja === 'ejercicio' ? (
            <Tarjeta titulo={`Cumplimiento documental${ficha.d.nivelCompliance ? ` · ${ficha.d.nivelCompliance}/5` : ''}`}>
              {(
                [
                  ['Constancia de legitimación', ficha.d.docConstancia],
                  ['CCT', ficha.d.docCct],
                  ['Resolución positiva integral', ficha.d.docResolucionIntegral],
                  ['Resolución positiva salarial', ficha.d.docResolucionSalarial],
                  ['Convenio salarial', ficha.d.docConvenioSalarial],
                ] as Array<[string, string | undefined]>
              ).map(([etq, v], i, arr) => (
                <View key={etq} style={[styles.doc, i < arr.length - 1 && styles.linea]}>
                  <View style={[styles.punto, { backgroundColor: v === 'SI' ? colors.ok : v === 'NO' ? colors.oxRed : colors.oxGold }]} />
                  <Text style={styles.docEtq}>{etq}</Text>
                  <Text style={styles.docValor}>{v === 'SI' ? 'Sí' : v === 'NO' ? 'No' : v || '—'}</Text>
                </View>
              ))}
            </Tarjeta>
          ) : null}

          {historial.length ? (
            <Tarjeta titulo="Historial de Oaxaca">
              {historial.map((h, i) => (
                <View key={`${h.anio}-${i}`} style={[styles.hist, i < historial.length - 1 && styles.linea]}>
                  <Text style={styles.histAnio}>{h.anio}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.histTitulo}>
                      {h.tipoRevision || 'Revisión'} · +{pct(h.pctSalario)}
                      {typeof h.pctPrestaciones === 'number' ? ` · prestaciones +${pct(h.pctPrestaciones)}` : ''}
                    </Text>
                    <Text style={styles.histMeta}>
                      {h.estatusRevision || ''} {h.fechaRevision ? `el ${fecha(h.fechaRevision)}` : ''}
                      {h.estatusConsulta ? ` · consulta ${h.estatusConsulta.toLowerCase()}` : ''}
                    </Text>
                  </View>
                </View>
              ))}
            </Tarjeta>
          ) : null}

          {plazas.length ? (
            <>
              <Tarjeta titulo={`Aumento nominal ${anio}: cuántas plazas`}>
                {distribucion.map(([k, n]) => (
                  <View key={k} style={styles.barraFila}>
                    <Text style={[styles.barraEtq, k === pct(subidaOax) && styles.barraEtqOax]}>{k}</Text>
                    <View style={styles.barraFondo}>
                      <View style={[styles.barraLlena, k === pct(subidaOax) && styles.barraOax, { width: `${Math.max(3, (n / maxDist) * 100)}%` }]} />
                    </View>
                    <Text style={styles.barraValor}>{n}</Text>
                  </View>
                ))}
                <Text style={styles.nota}>En rojo, el aumento de Oaxaca.</Text>
              </Tarjeta>

              <Tarjeta titulo="Sindicatos">
                {sindicatos.map(([s, n], i) => (
                  <Fila key={s} etq={s} valor={`${n} ${n === 1 ? 'plaza' : 'plazas'}`} ultimo={i === sindicatos.length - 1} />
                ))}
              </Tarjeta>

              <View style={styles.buscador}>
                <Icon name="search" size={18} color={colors.ink3} />
                <TextInput
                  style={styles.buscadorInput}
                  value={texto}
                  onChangeText={setTexto}
                  placeholder="Buscar plaza, estado o sindicato"
                  placeholderTextColor={colors.ink3}
                  autoCorrect={false}
                />
              </View>
              <Text style={styles.resumen}>
                {lista.length} {lista.length === 1 ? 'plaza' : 'plazas'} · de mayor a menor aumento
              </Text>
              {lista.map((d, i) => (
                <View key={`${d.plaza}-${i}`} style={[styles.plaza, esOaxaca(d) && styles.plazaOax]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.plazaNombre} numberOfLines={2}>
                      {d.plaza}
                    </Text>
                    <Text style={styles.plazaMeta} numberOfLines={1}>
                      {d.entidad} · {d.sindicato} · {d.tipoRevision}
                    </Text>
                    <Text style={styles.plazaMeta} numberOfLines={1}>
                      Vence {fecha(d.vencimiento)}
                      {typeof d.pctCompliance === 'number' ? ` · cumplimiento ${pct(d.pctCompliance, 0)}` : ''}
                    </Text>
                  </View>
                  <Text style={styles.plazaPct}>+{pct(d.pctSalarioNominal)}</Text>
                </View>
              ))}
            </>
          ) : null}
          <Text style={styles.nota}>Datos del Excel de contratos colectivos que carga RH. No incluye responsables ni expedientes de SharePoint.</Text>
        </ScrollView>
      )}
    </View>
  );
}

function Tarjeta({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{titulo}</Text>
      {children}
    </View>
  );
}

function Fila({ etq, valor, ultimo }: { etq: string; valor?: string; ultimo?: boolean }) {
  return (
    <View style={[styles.datoFila, !ultimo && styles.linea]}>
      <Text style={styles.datoEtq}>{etq}</Text>
      <Text style={styles.datoValor}>{valor || '—'}</Text>
    </View>
  );
}

function Dato({ titulo, valor, nota }: { titulo: string; valor: string; nota: string }) {
  return (
    <View style={[styles.card, styles.kpi]}>
      <Text style={styles.kpiTitulo} numberOfLines={2}>
        {titulo}
      </Text>
      <Text style={styles.kpiValor} numberOfLines={1} adjustsFontSizeToFit>
        {valor}
      </Text>
      <Text style={styles.kpiNota}>{nota}</Text>
    </View>
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
  hero: { borderRadius: 24, padding: 20, ...shadows.hero },
  heroKicker: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 12, color: 'rgba(255,255,255,.84)', textTransform: 'uppercase' },
  heroNumero: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 52, lineHeight: 60, color: colors.white, marginTop: 4 },
  heroBody: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: colors.white, marginTop: -2 },
  heroMeta: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12.5, lineHeight: 18, color: 'rgba(255,255,255,.88)', marginTop: 10 },
  fila: { flexDirection: 'row', gap: 10 },
  card: {
    borderRadius: radii.xl,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    ...shadows.card,
  },
  cardTitle: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 16, color: colors.ink, marginBottom: 4 },
  kpi: { flex: 1, padding: 12 },
  kpiTitulo: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11.5, color: colors.ink2 },
  kpiValor: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 19, color: colors.ink, marginTop: 4 },
  kpiNota: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, color: colors.ink3, marginTop: 2 },
  datoFila: { paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  linea: { borderBottomWidth: 1, borderBottomColor: colors.line },
  datoEtq: { flexShrink: 1, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: colors.ink2 },
  datoValor: { flexShrink: 1, textAlign: 'right', fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: colors.ink },
  doc: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  punto: { width: 9, height: 9, borderRadius: 5 },
  docEtq: { flex: 1, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: colors.ink },
  docValor: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: colors.ink },
  hist: { flexDirection: 'row', gap: 12, paddingVertical: 10, alignItems: 'center' },
  histAnio: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 17, color: colors.oxRed, width: 48 },
  histTitulo: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13.5, color: colors.ink },
  histMeta: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: colors.ink2, marginTop: 2 },
  barraFila: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
  barraEtq: { width: 52, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12.5, color: colors.ink2 },
  barraEtqOax: { color: colors.oxRed },
  barraFondo: { flex: 1, height: 9, borderRadius: 5, backgroundColor: colors.field, overflow: 'hidden' },
  barraLlena: { height: 9, borderRadius: 5, backgroundColor: '#F3A39C' },
  barraOax: { backgroundColor: colors.oxRed },
  barraValor: { width: 32, textAlign: 'right', fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12.5, color: colors.ink },
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
  plaza: {
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
  plazaOax: { borderColor: colors.oxRed, borderWidth: 1.5, backgroundColor: '#FFF6F4' },
  plazaNombre: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 14, color: colors.ink },
  plazaMeta: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: colors.ink2, marginTop: 2 },
  plazaPct: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 17, color: colors.oxRed },
  aviso: { alignItems: 'center', gap: 8, paddingVertical: 28 },
  avisoTitulo: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 16, color: colors.ink, textAlign: 'center' },
  avisoTexto: { ...type.caption, color: colors.ink2, textAlign: 'center', maxWidth: 300 },
  avisoBoton: { marginTop: 6, paddingHorizontal: 18, paddingVertical: 10, borderRadius: radii.pill, backgroundColor: colors.oxRed },
  avisoBotonTexto: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13.5, color: colors.white },
});
