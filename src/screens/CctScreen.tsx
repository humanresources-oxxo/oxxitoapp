// src/screens/CctScreen.tsx
// Contratos colectivos (CCT), app only. Same layout as RH's "Contratos
// Colectivos de Trabajo" board: filters (año, negocio, cluster, sindicato,
// tipo and estatus de revisión), the headline numbers (colaboradores,
// contratos, incremento nominal / salario total / prestaciones), revisiones por
// tipo and nuevos CCT, sindicato, estatus de revisiones and consultas,
// negociaciones por mes by business unit, avance de consultas and compliance.
// Below, folded, Plaza Oaxaca's own contract and every plaza.
// Data uploaded by RH from DashboardsOxxo's admin panel (services/cct.ts).
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { PinUnaVez } from '../components/PinUnaVez';
import { getJson, storageKeys } from '../services/appStorage';
import { esSinSesion } from '../services/sesion';
import { Anillo, ColumnasApiladas, Desplegable, Indicador, Leyenda } from '../components/Visual';
import { cargarCct, Cct, CctDatos, esOaxaca } from '../services/cct';
import { normalizarNombre, sinAcentos } from '../services/gviz';
import { colors, radii, shadows, type } from '../theme/tokens';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function fecha(iso?: string) {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${+m[3]} ${MESES[+m[2] - 1]} ${m[1]}` : '—';
}
const pct = (f?: number | null, dec = 1) => (typeof f === 'number' ? `${(f * 100).toLocaleString('es-MX', { maximumFractionDigits: dec })}%` : '—');
const num = (n?: number | null) => (typeof n === 'number' ? n.toLocaleString('es-MX') : '—');
const dinero = (n?: number | null) => (typeof n === 'number' ? `$${n.toLocaleString('es-MX', { maximumFractionDigits: 2 })}` : '—');
const miles = (n: number) => (n >= 1000 ? `${(n / 1000).toLocaleString('es-MX', { maximumFractionDigits: 1 })} mil` : num(n));
// Mean of the fractions that make sense (0 to 1); a stray value in the Excel is left out.
function media(valores: Array<number | undefined>) {
  const v = valores.filter((x): x is number => typeof x === 'number' && x >= 0 && x <= 1);
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
}
// "Pacifico" and "Pacífico" are the same cluster.
const etiqueta = (v?: string) => {
  const t = String(v ?? '').trim();
  return t ? sinAcentos(t).toLowerCase().replace(/(^|[\s-])\S/g, (l) => l.toUpperCase()) : 'Sin dato';
};
// "Realizada en 2026", "Consultado"... -> the board's three states.
function consultaDe(v?: string) {
  const t = sinAcentos(v ?? '').toLowerCase();
  if (!t) return '';
  if (/program/.test(t)) return 'Programada';
  if (/no realiz|pendient/.test(t)) return 'Pendiente';
  if (/realiz|consultad/.test(t)) return 'Realizada';
  return etiqueta(v);
}
function diasVsVencimiento(d?: number) {
  if (typeof d !== 'number') return '';
  if (d === 0) return 'el día del vencimiento';
  return `${Math.abs(d)} ${Math.abs(d) === 1 ? 'día' : 'días'} ${d < 0 ? 'antes' : 'después'} del vencimiento`;
}

const NEGOCIOS: Record<string, string> = { CEDIS: '#3B9AE1', Distribucion: colors.oxBlue, Smart: colors.oxOrange, Tiendas: '#7A1F8F' };
const colorNegocio = (n: string) => NEGOCIOS[sinAcentos(n)] || colors.ink3;
const SINDICATOS = ['#D9434F', '#6A1B7A', colors.oxGold, '#2F8FE0', colors.ink3];
const ESTATUS: Record<string, string> = { Realizada: colors.ok, Revisado: '#7BC47F', Pendiente: '#E6CF6E', Programada: '#2F8FE0' };

type Filtros = { negocio: string; cluster: string; sindicato: string; tipo: string; estatus: string };
const SIN_FILTROS: Filtros = { negocio: '', cluster: '', sindicato: '', tipo: '', estatus: '' };

export function CctScreen({ onBack }: { onBack: () => void }) {
  const [cct, setCct] = useState<Cct | null>(null);
  const [error, setError] = useState(false);
  // The Apps Script didn't accept the session key: confirm the PIN once.
  const [sinSesion, setSinSesion] = useState(false);
  const [pedirPin, setPedirPin] = useState(false);
  // PIN already confirmed in this screen: if the server still rejects the
  // session, the problem is on its side (it couldn't check it), not the PIN.
  const [pinConfirmado, setPinConfirmado] = useState(false);
  const [numero, setNumero] = useState('');
  const [intento, setIntento] = useState(0);
  const [anio, setAnio] = useState(0);
  const [filtros, setFiltros] = useState<Filtros>(SIN_FILTROS);
  const [texto, setTexto] = useState('');

  useEffect(() => {
    getJson<{ numeroEmpleado?: string } | null>(storageKeys.session, null).then((x) => setNumero(x?.numeroEmpleado ?? ''));
  }, []);

  useEffect(() => {
    let activo = true;
    setCct(null);
    setError(false);
    setSinSesion(false);
    cargarCct()
      .then((c) => {
        if (!activo) return;
        setCct(c);
        setAnio((a) => a || Math.max(0, ...[...c.ejercicio, ...c.historico].map((d) => d.anio || 0)));
      })
      .catch((e) => {
        if (!activo) return;
        setSinSesion(esSinSesion(e));
        setError(true);
      });
    return () => {
      activo = false;
    };
  }, [intento]);

  // A year with its own "ejercicio" sheet uses it (it has salario total and
  // compliance); older years come from the historical sheet.
  const anios = useMemo(() => [...new Set([...(cct?.ejercicio || []), ...(cct?.historico || [])].map((d) => d.anio || 0))].filter(Boolean).sort((a, b) => b - a), [cct]);
  const conEjercicio = !!cct?.ejercicio.some((d) => d.anio === anio);
  const delAnio = useMemo(
    () => (conEjercicio ? cct?.ejercicio || [] : cct?.historico || []).filter((d) => d.anio === anio),
    [cct, anio, conEjercicio]
  );
  const opciones = (f: (d: CctDatos) => string) => [...new Set(delAnio.map(f))].filter((x) => x && x !== 'Sin dato').sort((a, b) => a.localeCompare(b, 'es'));
  const filas = useMemo(
    () =>
      delAnio.filter(
        (d) =>
          (!filtros.negocio || etiqueta(d.udn) === filtros.negocio) &&
          (!filtros.cluster || etiqueta(d.cluster) === filtros.cluster) &&
          (!filtros.sindicato || (d.sindicato || 'Sin dato') === filtros.sindicato) &&
          (!filtros.tipo || etiqueta(d.tipoRevision) === filtros.tipo) &&
          (!filtros.estatus || etiqueta(d.estatusRevision) === filtros.estatus)
      ),
    [delAnio, filtros]
  );
  const activos = Object.values(filtros).filter(Boolean).length;

  // Headline numbers.
  const colaboradores = filas.reduce((s, d) => s + (d.hc || 0), 0);
  const nominal = media(filas.map((d) => (conEjercicio ? d.pctSalarioNominal : d.pctSalario)));
  const salarioTotal = conEjercicio ? media(filas.map((d) => d.pctSalario)) : null;
  const prestaciones = media(filas.map((d) => d.pctPrestaciones));
  const cuenta = (f: (d: CctDatos) => string) => {
    const m = new Map<string, number>();
    filas.forEach((d) => {
      const k = f(d);
      if (k) m.set(k, (m.get(k) || 0) + 1);
    });
    return [...m].sort((a, b) => b[1] - a[1]);
  };
  const porTipo = cuenta((d) => etiqueta(d.tipoRevision));
  const nuevos = filas.filter((d) => d.formaCreacion && !/legitim/i.test(d.formaCreacion)).length;
  const porSindicato = cuenta((d) => d.sindicato || 'Sin dato');
  const porEstatus = cuenta((d) => etiqueta(d.estatusRevision));
  const porConsulta = cuenta((d) => consultaDe(d.estatusConsulta));
  const consultas = porConsulta.reduce((s, [, n]) => s + n, 0);
  const nConsulta = (k: string) => porConsulta.find(([x]) => x === k)?.[1] || 0;
  const aprobacion = media(filas.map((d) => d.aprobacion));
  const participacion = media(filas.map((d) => d.participacion));
  const compliance = conEjercicio ? media(filas.map((d) => d.pctCompliance)) : null;

  // Negociaciones por mes (revision date), stacked by business unit.
  const negocios = useMemo(() => [...new Set(filas.map((d) => etiqueta(d.udn)))].sort(), [filas]);
  const porMes = useMemo(() => {
    const m = new Map<string, Map<string, number>>();
    filas.forEach((d) => {
      const mes = (d.fechaRevision || '').slice(0, 7);
      if (!mes) return;
      if (!m.has(mes)) m.set(mes, new Map());
      const n = etiqueta(d.udn);
      m.get(mes)!.set(n, (m.get(mes)!.get(n) || 0) + 1);
    });
    return [...m]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([mes, por]) => ({ clave: mes, etiqueta: MESES[+mes.slice(5) - 1], segmentos: negocios.map((n) => ({ valor: por.get(n) || 0, color: colorNegocio(n) })) }));
  }, [filas, negocios]);

  // Plaza Oaxaca's own contract (the ejercicio row when there is one).
  const oaxEjercicio = cct?.ejercicio.find((d) => esOaxaca(d) && d.anio === anio) || cct?.ejercicio.find(esOaxaca);
  const historial = useMemo(() => (cct?.historico || []).filter(esOaxaca).sort((a, b) => (b.anio || 0) - (a.anio || 0)), [cct]);
  const oax = oaxEjercicio || historial[0];
  const oaxSubida = oax ? (oaxEjercicio ? oax.pctSalarioNominal : oax.pctSalario) : undefined;

  const plazas = useMemo(() => {
    const n = normalizarNombre(texto);
    return [...filas]
      .sort((a, b) => ((conEjercicio ? b.pctSalarioNominal : b.pctSalario) || 0) - ((conEjercicio ? a.pctSalarioNominal : a.pctSalario) || 0))
      .filter((d) => !n || normalizarNombre(`${d.plaza} ${d.entidad} ${d.cluster} ${d.sindicato}`).includes(n));
  }, [filas, texto, conEjercicio]);

  const cargado = cct?.cargadoEl ? fecha(cct.cargadoEl.slice(0, 10)) : '';
  const pon = (k: keyof Filtros, v: string) => setFiltros((f) => ({ ...f, [k]: f[k] === v ? '' : v }));

  return (
    <View style={styles.screen}>
      <LinearGradient colors={['#FFF7F0', colors.bg, '#FFFFFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" style={styles.headerButton} onPress={onBack} accessibilityLabel="Regresar">
            <Icon name="chevL" size={20} color={colors.ink} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>OXXO · todas las plazas{cargado ? ` · ${cargado}` : ''}</Text>
            <Text style={styles.title}>Contratos colectivos</Text>
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
            <Aviso titulo="No se pudieron cargar los contratos" texto="Revisa tu conexión e intenta de nuevo." accion={{ texto: 'Reintentar', onPress: () => setIntento((i) => i + 1) }} />
          )}
        </View>
      ) : !cct ? (
        <View style={styles.cargando}>
          <ActivityIndicator color={colors.oxRed} />
        </View>
      ) : !anios.length ? (
        <View style={styles.content}>
          <Aviso titulo="Todavía no hay datos" texto="RH aún no ha cargado el Excel de contratos colectivos en el panel admin." />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.chips}>
            {anios.map((a) => (
              <Chip key={a} texto={String(a)} activo={a === anio} onPress={() => { setAnio(a); setFiltros(SIN_FILTROS); }} />
            ))}
          </View>

          <Desplegable
            titulo="Filtros"
            icono="settings"
            resumen={activos ? Object.values(filtros).filter(Boolean).join(' · ') : 'Negocio, cluster, sindicato, tipo y estatus'}
            derecha={
              activos ? (
                <Pressable onPress={() => setFiltros(SIN_FILTROS)} style={styles.limpiar} accessibilityRole="button">
                  <Text style={styles.limpiarTxt}>Quitar</Text>
                </Pressable>
              ) : null
            }
          >
            <Grupo titulo="Negocio" valores={opciones((d) => etiqueta(d.udn))} activo={filtros.negocio} onPress={(v) => pon('negocio', v)} />
            <Grupo titulo="Cluster / zona" valores={opciones((d) => etiqueta(d.cluster))} activo={filtros.cluster} onPress={(v) => pon('cluster', v)} />
            <Grupo titulo="Sindicato" valores={opciones((d) => d.sindicato || '')} activo={filtros.sindicato} onPress={(v) => pon('sindicato', v)} />
            <Grupo titulo="Tipo de revisión" valores={opciones((d) => etiqueta(d.tipoRevision))} activo={filtros.tipo} onPress={(v) => pon('tipo', v)} />
            <Grupo titulo="Estatus de revisión" valores={opciones((d) => etiqueta(d.estatusRevision))} activo={filtros.estatus} onPress={(v) => pon('estatus', v)} />
          </Desplegable>

          <View style={styles.franja}>
            <View style={styles.fila}>
              <Indicador valor={miles(colaboradores)} etiqueta="Colaboradores" />
              <Indicador valor={num(filas.length)} etiqueta="Contratos" />
            </View>
            <View style={styles.fila}>
              <Indicador valor={pct(nominal)} etiqueta="Incr. nominal" tono={colors.oxRed} />
              <Indicador valor={pct(salarioTotal)} etiqueta="Incr. salario total" tono={colors.oxRed} />
              <Indicador valor={pct(prestaciones)} etiqueta="Incr. prestaciones" tono={colors.oxRed} />
            </View>
          </View>

          <View style={styles.fila}>
            <View style={[styles.card, { flex: 2 }]}>
              <Banda texto="Revisiones por tipo" />
              <View style={styles.fila}>
                {(porTipo.length ? porTipo : [['Salarial', 0] as [string, number]]).slice(0, 2).map(([t, n]) => (
                  <View key={t} style={styles.mini}>
                    <Text style={styles.miniNum}>{n}</Text>
                    <Text style={styles.miniTxt}>{t}</Text>
                  </View>
                ))}
              </View>
            </View>
            <View style={[styles.card, { flex: 1 }]}>
              <Banda texto="Nuevos CCT" />
              <View style={styles.mini}>
                <Text style={styles.miniNum}>{nuevos}</Text>
                <Text style={styles.miniTxt}>Inicial</Text>
              </View>
            </View>
          </View>

          <Grafica titulo="Sindicato">
            <Anillo
              segmentos={porSindicato.map(([, n], i) => ({ valor: n, color: SINDICATOS[Math.min(i, SINDICATOS.length - 1)] }))}
              centro={<Text style={styles.anilloNum}>{filas.length}</Text>}
            />
            <View style={{ flex: 1 }}>
              <Leyenda items={porSindicato.map(([s, n], i) => ({ etiqueta: s, valor: String(n), color: SINDICATOS[Math.min(i, SINDICATOS.length - 1)] }))} />
            </View>
          </Grafica>

          <Grafica titulo="Estatus revisiones">
            <Anillo
              segmentos={porEstatus.map(([e, n]) => ({ valor: n, color: ESTATUS[e] || colors.ink3 }))}
              centro={<Text style={styles.anilloNum}>{filas.length}</Text>}
            />
            <View style={{ flex: 1 }}>
              <Leyenda items={porEstatus.map(([e, n]) => ({ etiqueta: e, valor: `${n} · ${pct(filas.length ? n / filas.length : 0, 0)}`, color: ESTATUS[e] || colors.ink3 }))} />
            </View>
          </Grafica>

          <View style={styles.card}>
            <Banda texto="Negociaciones por mes" />
            {porMes.length ? (
              <>
                <View style={styles.leyendaFila}>
                  {negocios.map((n) => (
                    <View key={n} style={styles.leyendaItem}>
                      <View style={[styles.leyendaPunto, { backgroundColor: colorNegocio(n) }]} />
                      <Text style={styles.leyendaTxt}>{n}</Text>
                    </View>
                  ))}
                </View>
                <ColumnasApiladas datos={porMes} />
              </>
            ) : (
              <Text style={styles.nota}>Sin fechas de revisión con estos filtros.</Text>
            )}
          </View>

          <Grafica titulo="Estatus consultas">
            {consultas ? (
              <>
                <Anillo
                  segmentos={porConsulta.map(([e, n]) => ({ valor: n, color: ESTATUS[e] || colors.ink3 }))}
                  centro={<Text style={styles.anilloNum}>{consultas}</Text>}
                />
                <View style={{ flex: 1 }}>
                  <Leyenda items={porConsulta.map(([e, n]) => ({ etiqueta: e, valor: `${n} · ${pct(n / consultas, 0)}`, color: ESTATUS[e] || colors.ink3 }))} />
                </View>
              </>
            ) : (
              <Text style={styles.nota}>Sin consultas con estos filtros.</Text>
            )}
          </Grafica>

          <View style={styles.card}>
            <Banda texto="Avance consultas" />
            <View style={styles.fila}>
              <View style={styles.mini}>
                <Text style={styles.miniNum}>{pct(aprobacion, 0)}</Text>
                <Text style={styles.miniTxt}>Aprobación</Text>
              </View>
              <View style={styles.mini}>
                <Text style={styles.miniNum}>{pct(participacion, 0)}</Text>
                <Text style={styles.miniTxt}>Participación</Text>
              </View>
            </View>
            <View style={[styles.fila, { marginTop: 8 }]}>
              {(['Realizada', 'Pendiente', 'Programada'] as const).map((k) => (
                <View key={k} style={styles.mini}>
                  <Text style={styles.miniNum}>{nConsulta(k)}</Text>
                  <Text style={styles.miniTxt}>{k === 'Realizada' ? 'Realizadas' : k === 'Pendiente' ? 'Pendientes' : 'Programadas'}</Text>
                </View>
              ))}
            </View>
          </View>

          {compliance !== null ? (
            <View style={[styles.card, styles.compliance]}>
              <Text style={styles.complianceTit}>Compliance</Text>
              <Text style={styles.complianceNum}>{pct(compliance, 0)}</Text>
            </View>
          ) : null}

          {oax ? (
            <Desplegable
              titulo="Plaza Oaxaca"
              icono="pin"
              resumen={`Revisión ${oax.anio} ${(oax.tipoRevision || '').toLowerCase()} · +${pct(oaxSubida)}${oax.nivelCompliance ? ` · cumplimiento ${oax.nivelCompliance}/5` : ''}`}
            >
              <Fila etq="Aumento nominal" valor={`+${pct(oaxSubida)}`} />
              {oaxEjercicio ? <Fila etq="Incr. salario total" valor={pct(oax.pctSalario)} /> : null}
              <Fila etq="Revisión" valor={`${oax.estatusRevision || '—'} ${oax.fechaRevision ? fecha(oax.fechaRevision) : ''}`} />
              <Fila etq="Contra el vencimiento" valor={diasVsVencimiento(oax.diasRevision) || '—'} />
              <Fila etq="Sindicato" valor={oax.sindicato} />
              <Fila etq="Expediente" valor={oax.expediente} />
              <Fila etq="Plantilla / centros de trabajo" valor={`${num(oax.hc)} / ${num(oax.cts)}`} />
              <Fila etq="Legitimación" valor={oax.anioLegitimacion ? `${oax.anioLegitimacion} · ${pct(oax.aprobacionLeg, 0)} de aprobación` : '—'} />
              <Fila etq="Salario base / vales" valor={`${dinero(oax.salarioBase)} / ${dinero(oax.valesMin)}`} />
              <Fila etq="Aguinaldo / primas" valor={`${oax.aguinaldoDias ?? '—'} días / ${pct(oax.primaVacacional, 0)} y ${pct(oax.primaDominical, 0)}`} ultimo={!historial.length} />
              {historial.length ? <Fila etq="Historial" valor={historial.map((h) => `${h.anio} +${pct(h.pctSalario)}`).join(' · ')} ultimo /> : null}
            </Desplegable>
          ) : null}

          <Desplegable titulo="Plazas" icono="globe" resumen={`${filas.length} contratos · de mayor a menor aumento`}>
            <View style={styles.buscador}>
              <Icon name="search" size={18} color={colors.ink3} />
              <TextInput
                style={styles.buscadorInput}
                value={texto}
                onChangeText={setTexto}
                placeholder="Plaza, estado o sindicato"
                placeholderTextColor={colors.ink3}
                autoCorrect={false}
              />
            </View>
            {(texto ? plazas : plazas.slice(0, 10)).map((d, i) => (
              <View key={`${d.plaza}-${i}`} style={[styles.plaza, esOaxaca(d) && styles.plazaOax]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.plazaNombre} numberOfLines={1}>
                    {d.plaza}
                  </Text>
                  <Text style={styles.plazaMeta} numberOfLines={1}>
                    {d.entidad} · {d.sindicato} · {etiqueta(d.tipoRevision)}
                  </Text>
                </View>
                <Text style={styles.plazaPct}>+{pct(conEjercicio ? d.pctSalarioNominal : d.pctSalario)}</Text>
              </View>
            ))}
            {!texto && plazas.length > 10 ? <Text style={styles.nota}>Las 10 con mayor aumento; busca para ver las demás.</Text> : null}
          </Desplegable>

          <Text style={styles.nota}>
            Excel de contratos colectivos que carga RH{conEjercicio ? ` (hoja del ejercicio ${anio})` : ` (histórico ${anio})`}. Los promedios son por contrato. No
            incluye responsables ni expedientes de SharePoint.
          </Text>
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

// Yellow title band, like the board's section headers.
function Banda({ texto }: { texto: string }) {
  return (
    <View style={styles.banda}>
      <Text style={styles.bandaTxt}>{texto}</Text>
    </View>
  );
}

function Grafica({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <Banda texto={titulo} />
      <View style={styles.anilloFila}>{children}</View>
    </View>
  );
}

function Grupo({ titulo, valores, activo, onPress }: { titulo: string; valores: string[]; activo: string; onPress: (v: string) => void }) {
  if (valores.length < 2 && !activo) return null;
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.subTitulo}>{titulo}</Text>
      <View style={styles.chips}>
        {valores.map((v) => (
          <Chip key={v} texto={v} activo={activo === v} onPress={() => onPress(v)} />
        ))}
      </View>
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

function Chip({ texto, activo, onPress }: { texto: string; activo: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" style={[styles.chip, activo && styles.chipActivo]} onPress={onPress} accessibilityState={{ selected: activo }}>
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
        <Pressable accessibilityRole="button" style={styles.avisoBoton} onPress={accion.onPress}>
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
  fila: { flexDirection: 'row', gap: 10 },
  franja: { gap: 10, padding: 10, borderRadius: radii.xl, backgroundColor: '#F6C9CC' },
  card: {
    borderRadius: radii.xl,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    ...shadows.card,
  },
  banda: { alignSelf: 'stretch', borderRadius: 10, backgroundColor: '#D8B200', paddingVertical: 7, marginBottom: 12 },
  bandaTxt: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 12, color: colors.ink, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.4 },
  mini: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.line },
  miniNum: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 24, color: colors.ink },
  miniTxt: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: colors.ink2, marginTop: 2 },
  anilloFila: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  anilloNum: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 22, color: colors.ink },
  leyendaFila: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 10 },
  leyendaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  leyendaPunto: { width: 10, height: 10, borderRadius: 5 },
  leyendaTxt: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: colors.ink2 },
  compliance: { alignItems: 'center', borderColor: '#8FE39A', borderWidth: 2 },
  complianceTit: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 12, color: colors.ink2, textTransform: 'uppercase', letterSpacing: 0.6 },
  complianceNum: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 36, color: colors.ink, marginTop: 4 },
  limpiar: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radii.pill, backgroundColor: '#FFF0EC' },
  limpiarTxt: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 12, color: colors.oxRed },
  subTitulo: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 12, color: colors.ink3, textTransform: 'uppercase', letterSpacing: 0.8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: radii.pill, backgroundColor: colors.field, borderWidth: 1, borderColor: colors.line },
  chipActivo: { backgroundColor: colors.oxRed, borderColor: colors.oxRed },
  chipText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: colors.ink2 },
  chipTextActivo: { color: colors.white },
  datoFila: { paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  linea: { borderBottomWidth: 1, borderBottomColor: colors.line },
  datoEtq: { flexShrink: 1, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: colors.ink2 },
  datoValor: { flexShrink: 1, textAlign: 'right', fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: colors.ink },
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
  plaza: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  plazaOax: { backgroundColor: '#FFF6F4' },
  plazaNombre: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 14, color: colors.ink },
  plazaMeta: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: colors.ink2, marginTop: 2 },
  plazaPct: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 16, color: colors.oxRed },
  aviso: { alignItems: 'center', gap: 8, paddingVertical: 28 },
  avisoTitulo: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 16, color: colors.ink, textAlign: 'center' },
  avisoTexto: { ...type.caption, color: colors.ink2, textAlign: 'center', maxWidth: 300 },
  avisoBoton: { marginTop: 6, paddingHorizontal: 18, paddingVertical: 10, borderRadius: radii.pill, backgroundColor: colors.oxRed },
  avisoBotonTexto: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13.5, color: colors.white },
});
