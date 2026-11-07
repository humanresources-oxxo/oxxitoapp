// src/screens/VacacionesScreen.tsx
// Vacaciones: the employee's own balance (a ring with the previous and current
// period and when they expire) from DashboardsOxxo's Dashboard 5. Puestos with
// team access (same as Actas) also get "Mi equipo", laid out like the
// dashboards' Dashboard 6 (Ausentismos): filters (asesor, puesto), then the
// layers Resumen ejecutivo (colored indicator cards; vencidos / por vencer /
// al día filter the rest), Vencidos y por vencer, Foco y responsables and
// Exploración detallada. An AT only sees their own stores.
// Plaza Oaxaca only (see services/gviz.ts).
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { usePinDeSesion } from '../components/PinDeSesion';
import { Anillo, Barras, Desplegable, Leyenda } from '../components/Visual';
import { clave } from '../services/gviz';
import { getJson, storageKeys } from '../services/appStorage';
import {
  buscarVacaciones,
  cargarMiVacacion,
  cargarEquipo,
  fechaActualizacion,
  MiVacacion,
  normalizarNombre,
  urgencia,
  Vacacion,
} from '../services/vacaciones';
import { colors, gradients, radii, shadows, type } from '../theme/tokens';

type Sesion = { numeroEmpleado?: string; nombre?: string } | null;
type Vista = 'mias' | 'equipo';

const MAX_LISTA = 80;
const PASO_DETALLE = 20;
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function fechaCorta(iso: string) {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${+m[3]} ${MESES[+m[2] - 1]} ${m[1]}` : iso || '—';
}
const dias = (n: number) => `${n.toLocaleString('es-MX', { maximumFractionDigits: 1 })} ${n === 1 ? 'día' : 'días'}`;
const vence = (b: string) => (!b || /^n\/?a$/i.test(b) ? 'Sin días pendientes' : b.charAt(0).toUpperCase() + b.slice(1).toLowerCase());

export function VacacionesScreen({
  onBack,
  conEquipo = false,
  soloMisTiendas = false,
}: {
  onBack: () => void;
  conEquipo?: boolean;
  // Asesores de Tienda: the team view shows only their own stores.
  soloMisTiendas?: boolean;
}) {
  const [sesion, setSesion] = useState<Sesion>(null);
  const [vista, setVista] = useState<Vista>('mias');
  const [mia, setMia] = useState<MiVacacion | null>(null);
  const [errorMia, setErrorMia] = useState<unknown>(null);
  const [actualizado, setActualizado] = useState('');
  const [intento, setIntento] = useState(0);
  const pin = usePinDeSesion(() => setIntento((i) => i + 1));

  useEffect(() => {
    let activo = true;
    setErrorMia(null);
    setMia(null);
    getJson<Sesion>(storageKeys.session, null).then((s) => {
      if (!activo) return;
      setSesion(s);
      cargarMiVacacion(s?.numeroEmpleado ?? '')
        .then((r) => {
          if (!activo) return;
          setMia(r);
          // Office staff aren't in the report; with team access, go straight to the team.
          if (!r.vacacion && conEquipo) setVista('equipo');
        })
        .catch((e) => activo && setErrorMia(e ?? true));
    });
    fechaActualizacion().then((f) => activo && setActualizado(f));
    return () => {
      activo = false;
    };
  }, [intento, conEquipo]);

  return (
    <View style={styles.screen}>
      <LinearGradient colors={['#FFF7F0', colors.bg, '#FFFFFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={styles.header}>
          <Pressable style={styles.headerButton} onPress={onBack} accessibilityLabel="Regresar">
            <Icon name="chevL" size={20} color={colors.ink} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>Plaza Oaxaca{actualizado ? ` · ${actualizado}` : ''}</Text>
            <Text style={styles.title}>Vacaciones</Text>
          </View>
        </View>
        {conEquipo ? (
          <View style={styles.segmento}>
            {(['mias', 'equipo'] as Vista[]).map((v) => (
              <Pressable
                key={v}
                style={[styles.segBoton, vista === v && styles.segActivo]}
                onPress={() => setVista(v)}
                accessibilityRole="tab"
                accessibilityState={{ selected: vista === v }}
              >
                <Text style={[styles.segTexto, vista === v && styles.segTextoActivo]}>{v === 'mias' ? 'Mis vacaciones' : 'Mi equipo'}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </SafeAreaView>

      {vista === 'mias' ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {errorMia ? (
            <Aviso
              icono="alert"
              {...pin.aviso(errorMia, {
                titulo: 'No se pudo cargar tu saldo',
                texto: 'Revisa tu conexión e intenta de nuevo.',
                accion: { texto: 'Reintentar', onPress: () => setIntento((i) => i + 1) },
              })}
            />
          ) : !mia ? (
            <View style={styles.cargando}>
              <ActivityIndicator color={colors.oxRed} />
            </View>
          ) : mia.vacacion ? (
            <>
              {mia.guardada ? <Text style={styles.nota}>Sin conexión: se muestra el último saldo guardado.</Text> : null}
              <Saldo v={mia.vacacion} />
              <Text style={styles.nota}>
                Para solicitar o programar tus vacaciones habla con tu Asesor de Tienda{mia.vacacion.asesor ? ` (${mia.vacacion.asesor})` : ''}. Si
                tu saldo no coincide, repórtalo a RH.
              </Text>
            </>
          ) : (
            <Aviso
              icono="calendar"
              titulo="No apareces en el reporte de vacaciones"
              texto={`Aquí solo aparece el personal de tienda de Plaza Oaxaca. Si eres de tienda en Oaxaca y no apareces con el número ${
                sesion?.numeroEmpleado || ''
              }, avisa a RH.`}
            />
          )}
        </ScrollView>
      ) : (
        <Equipo sesion={sesion} soloMisTiendas={soloMisTiendas} />
      )}
      {pin.modal}
    </View>
  );
}

function Saldo({ v, compacto }: { v: Vacacion; compacto?: boolean }) {
  const u = urgencia(v);
  return (
    <View style={{ gap: 12 }}>
      <LinearGradient colors={gradients.oxGrad.colors} start={gradients.oxGrad.start} end={gradients.oxGrad.end} style={styles.hero}>
        <Text style={styles.heroKicker}>{compacto ? 'Le quedan' : 'Te quedan'}</Text>
        <Text style={styles.heroNumero}>{Number.isInteger(v.diasRestantes) ? v.diasRestantes : v.diasRestantes.toFixed(1)}</Text>
        <Text style={styles.heroBody}>{v.diasRestantes === 1 ? 'día de vacaciones' : 'días de vacaciones'}</Text>
        <Text style={styles.heroMeta}>
          {v.puesto} · {v.tienda}
        </Text>
      </LinearGradient>

      {u ? (
        <View style={[styles.alerta, u === 'vencido' && styles.alertaVencido]}>
          <Icon name="alert" size={19} color={u === 'vencido' ? colors.oxRed : '#B7791F'} />
          <Text style={styles.alertaTexto}>
            {u === 'vencido'
              ? `Los ${dias(v.periodoAnterior)} de tu periodo anterior ya vencieron. Habla con tu Asesor o con RH.`
              : `Tus ${dias(v.periodoAnterior)} del periodo anterior vencen en ${v.venceAnterior.toLowerCase()}. Prográmalos pronto.`}
          </Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{compacto ? 'Sus días' : 'Tus días'}</Text>
        <View style={styles.anilloFila}>
          <Anillo
            segmentos={[
              { valor: v.periodoAnterior, color: colors.oxGold },
              { valor: v.periodoActual, color: colors.oxBlue },
            ]}
            centro={
              <View style={{ alignItems: 'center' }}>
                <Text style={styles.anilloNum}>{Number.isInteger(v.diasRestantes) ? v.diasRestantes : v.diasRestantes.toFixed(1)}</Text>
                <Text style={styles.anilloTxt}>días</Text>
              </View>
            }
          />
          <View style={{ flex: 1, gap: 12 }}>
            <View>
              <Leyenda items={[{ etiqueta: 'Periodo anterior', valor: dias(v.periodoAnterior), color: colors.oxGold }]} />
              <Text style={styles.venceTxt}>Vence: {vence(v.venceAnterior)}</Text>
            </View>
            <View>
              <Leyenda items={[{ etiqueta: 'Periodo actual', valor: dias(v.periodoActual), color: colors.oxBlue }]} />
              <Text style={styles.venceTxt}>Vence: {vence(v.venceActual)}</Text>
            </View>
          </View>
        </View>
      </View>

      <Desplegable titulo="Detalles" icono="badge" resumen={`${fechaCorta(v.fechaInicio)} – ${fechaCorta(v.fechaFin)}${v.asesor ? ` · ${v.asesor}` : ''}`}>
        <Dato etq="Periodo del reporte" valor={`${fechaCorta(v.fechaInicio)} – ${fechaCorta(v.fechaFin)}`} />
        <Dato etq="Número de empleado" valor={v.numEmpleado} />
        <Dato etq="Asesor de tienda" valor={v.asesor || '—'} />
        <Dato etq="Plaza" valor={v.plaza || '—'} ultimo />
      </Desplegable>
    </View>
  );
}


function Dato({ etq, valor, ultimo }: { etq: string; valor: string; ultimo?: boolean }) {
  return (
    <View style={[styles.dato, !ultimo && styles.datoLinea]}>
      <Text style={styles.datoEtq}>{etq}</Text>
      <Text style={styles.datoValor}>{valor}</Text>
    </View>
  );
}

function Aviso({ icono, titulo, texto, accion }: { icono: string; titulo: string; texto: string; accion?: { texto: string; onPress: () => void } }) {
  return (
    <View style={[styles.card, styles.aviso]}>
      <Icon name={icono} size={26} color={colors.oxRed} />
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

// Rangos de Bucket_Ant (cuándo vence el periodo anterior), en el orden y con
// los colores del Dashboard 5. "N/A" = no le quedan días del periodo anterior.
const RANGOS_ANT: Array<{ clave: string; etiqueta: string; color: string }> = [
  { clave: 'yavencieronsusdias', etiqueta: 'Ya vencieron', color: '#D91F2D' },
  { clave: '0a50dias', etiqueta: '0 a 50 días', color: '#F06A24' },
  { clave: '51a100dias', etiqueta: '51 a 100 días', color: '#E0A100' },
  { clave: '101a150dias', etiqueta: '101 a 150 días', color: '#8DBF7A' },
  { clave: 'masde150dias', etiqueta: 'Más de 150 días', color: '#2E9E6B' },
];
const RANGO_SIN: { clave: string; etiqueta: string; color: string } = { clave: 'na', etiqueta: 'Sin días del periodo anterior', color: '#C9BDB6' };
const rangoAnt = (v: Vacacion) => RANGOS_ANT.find((r) => r.clave === clave(v.venceAnterior)) || RANGO_SIN;

// Colores de las tarjetas del Dashboard 6 (borde izquierdo de cada indicador).
const TONO = { rojo: '#D91F2D', naranja: '#C25A00', amarillo: '#A87C00', verde: '#157A49', azul: '#12608F', gris: colors.ink2 };
type Tono = keyof typeof TONO;
type FiltroKpi = 'vencido' | 'pronto' | 'aldia' | null;

const num = (n: number) => Math.round(n).toLocaleString('es-MX');
const diasCortos = (n: number) => `${num(n)} ${Math.round(n) === 1 ? 'día' : 'días'}`;
const personas = (n: number) => `${num(n)} ${n === 1 ? 'persona' : 'personas'}`;
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

function Equipo({ sesion, soloMisTiendas }: { sesion: Sesion; soloMisTiendas: boolean }) {
  const [filas, setFilas] = useState<Vacacion[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [texto, setTexto] = useState('');
  const [soloMias, setSoloMias] = useState(true);
  const [asesorSel, setAsesorSel] = useState('');
  const [puestoSel, setPuestoSel] = useState('');
  const [kpi, setKpi] = useState<FiltroKpi>(null);
  const [selector, setSelector] = useState<'asesor' | 'puesto' | null>(null);
  const [todosUrgentes, setTodosUrgentes] = useState(false);
  const [cuantos, setCuantos] = useState(PASO_DETALLE);
  const [detalle, setDetalle] = useState<Vacacion | null>(null);
  const [intento, setIntento] = useState(0);
  const pin = usePinDeSesion(() => setIntento((i) => i + 1));

  useEffect(() => {
    let activo = true;
    setFilas(null);
    setError(null);
    cargarEquipo()
      .then((l) => activo && setFilas(l))
      .catch((e) => activo && setError(e ?? true));
    return () => {
      activo = false;
    };
  }, [intento]);

  // An AT only sees their own stores (and nothing if their name isn't found).
  // Others get an optional "Mis tiendas" when they are the AT of some rows.
  const yo = normalizarNombre(sesion?.nombre);
  const tengoTiendas = useMemo(() => !!yo && !!filas?.some((f) => normalizarNombre(f.asesor) === yo), [filas, yo]);
  const enMisTiendas = soloMisTiendas || (tengoTiendas && soloMias);
  const sinTiendas = soloMisTiendas && !!filas && !tengoTiendas;
  // Alcance (mis tiendas o la plaza), antes de los filtros.
  const base = useMemo(() => {
    if (soloMisTiendas && !yo) return [];
    return buscarVacaciones(filas || [], '', enMisTiendas ? sesion?.nombre : undefined);
  }, [filas, soloMisTiendas, yo, enMisTiendas, sesion?.nombre]);
  // Como en el Dashboard 6, los filtros de asesor y puesto valen para toda la pantalla.
  const equipo = useMemo(
    () => base.filter((v) => (!asesorSel || v.asesor === asesorSel) && (!puestoSel || v.puesto === puestoSel)),
    [base, asesorSel, puestoSel]
  );
  const vencidos = equipo.filter((v) => urgencia(v) === 'vencido');
  const pronto = equipo.filter((v) => urgencia(v) === 'pronto');
  const alDia = equipo.length - vencidos.length - pronto.length;
  // Tocar un indicador filtra lo de abajo (como las tarjetas activas del tablero).
  const vista = useMemo(
    () => (kpi ? equipo.filter((v) => (kpi === 'aldia' ? !urgencia(v) : urgencia(v) === kpi)) : equipo),
    [equipo, kpi]
  );
  const totalDias = equipo.reduce((x, v) => x + v.diasRestantes, 0);
  const diasVencidos = vencidos.reduce((x, v) => x + v.periodoAnterior, 0);
  const diasPronto = pronto.reduce((x, v) => x + v.periodoAnterior, 0);
  const tiendas = new Set(equipo.map((v) => v.tienda)).size;
  const atender = useMemo(
    () => vista.filter((v) => urgencia(v)).sort((a, b) => (urgencia(a) === urgencia(b) ? b.periodoAnterior - a.periodoAnterior : urgencia(a) === 'vencido' ? -1 : 1)),
    [vista]
  );

  const opciones = (campo: 'asesor' | 'puesto') => {
    const m = new Map<string, number>();
    base.forEach((v) => v[campo] && m.set(v[campo], (m.get(v[campo]) || 0) + 1));
    return [...m].sort((a, b) => a[0].localeCompare(b[0], 'es'));
  };

  // Vencimiento del periodo anterior por rango.
  const porRango = useMemo(() => {
    const m = new Map<string, { personas: number; dias: number }>();
    vista.forEach((v) => {
      const r = rangoAnt(v).clave;
      const t = m.get(r) || { personas: 0, dias: 0 };
      t.personas += 1;
      t.dias += v.periodoAnterior;
      m.set(r, t);
    });
    return [...RANGOS_ANT, RANGO_SIN].map((r) => ({ ...r, ...(m.get(r.clave) || { personas: 0, dias: 0 }) }));
  }, [vista]);

  // Por asesor (o por tienda en las tiendas de un solo asesor): vencidos,
  // por vencer y al día, como "No justificados por Asesor".
  const porResponsable = enMisTiendas || asesorSel ? 'tienda' : 'asesor';
  const responsables = useMemo(() => {
    const m = new Map<string, { vencido: number; pronto: number; total: number; dias: number }>();
    vista.forEach((v) => {
      const k = (porResponsable === 'asesor' ? v.asesor : v.tienda) || 'Sin asesor';
      const t = m.get(k) || { vencido: 0, pronto: 0, total: 0, dias: 0 };
      const u = urgencia(v);
      if (u === 'vencido') t.vencido += 1;
      if (u === 'pronto') t.pronto += 1;
      t.total += 1;
      t.dias += v.diasRestantes;
      m.set(k, t);
    });
    return [...m].map(([nombre, t]) => ({ nombre, ...t })).sort((a, b) => b.vencido + b.pronto - (a.vencido + a.pronto) || b.total - a.total);
  }, [vista, porResponsable]);

  const agrupar = (campo: 'asesor' | 'tienda' | 'puesto') => {
    const m = new Map<string, { dias: number; personas: number; urgentes: number }>();
    vista.forEach((v) => {
      const k = v[campo] || 'Sin dato';
      const t = m.get(k) || { dias: 0, personas: 0, urgentes: 0 };
      t.dias += v.diasRestantes;
      t.personas += 1;
      if (urgencia(v)) t.urgentes += 1;
      m.set(k, t);
    });
    return [...m]
      .map(([etiqueta, t]) => ({ etiqueta, valor: t.dias, detalle: `${personas(t.personas)}${t.urgentes ? ` · ${t.urgentes} por vencer o vencidos` : ''}` }))
      .sort((a, b) => b.valor - a.valor);
  };
  const porAsesor = useMemo(() => agrupar('asesor'), [vista]);
  const porTienda = useMemo(() => agrupar('tienda'), [vista]);
  const porPuesto = useMemo(() => agrupar('puesto'), [vista]);
  const resultado = useMemo(() => buscarVacaciones(vista, texto), [vista, texto]);
  // Cada búsqueda o filtro vuelve a empezar por los primeros.
  useEffect(() => setCuantos(PASO_DETALLE), [vista, texto]);

  const fila = (item: Vacacion, i: number, arr: Vacacion[]) => {
    const u = urgencia(item);
    return (
      <Pressable key={item.numEmpleado} style={[styles.persona, i < arr.length - 1 && styles.linea]} onPress={() => setDetalle(item)}>
        <View style={[styles.personaBarra, { backgroundColor: u === 'vencido' ? TONO.rojo : u === 'pronto' ? '#F06A24' : colors.ok }]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.personaNombre} numberOfLines={1}>
            {item.nombre}
          </Text>
          <Text style={styles.personaMeta} numberOfLines={1}>
            {u === 'vencido'
              ? `${dias(item.periodoAnterior)} vencidos · `
              : u === 'pronto'
                ? `${dias(item.periodoAnterior)} vencen en ${item.venceAnterior.toLowerCase()} · `
                : ''}
            {item.tienda}
          </Text>
        </View>
        <Text style={styles.personaNumero}>{Number.isInteger(item.diasRestantes) ? item.diasRestantes : item.diasRestantes.toFixed(1)} d</Text>
      </Pressable>
    );
  };

  const filtrosActivos = !!asesorSel || !!puestoSel || !!kpi;
  const limpiar = () => {
    setAsesorSel('');
    setPuestoSel('');
    setKpi(null);
  };
  const alternar = (k: Exclude<FiltroKpi, null>) => setKpi((x) => (x === k ? null : k));
  const nombreKpi = kpi === 'vencido' ? 'vencidos' : kpi === 'pronto' ? 'que vencen en 0 a 50 días' : kpi === 'aldia' ? 'al día' : '';

  return (
    <>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {error ? (
          <Aviso
            icono="alert"
            {...pin.aviso(error, {
              titulo: 'No se pudo cargar el equipo',
              texto: 'Revisa tu conexión e intenta de nuevo.',
              accion: { texto: 'Reintentar', onPress: () => setIntento((i) => i + 1) },
            })}
          />
        ) : !filas ? (
          <View style={styles.cargando}>
            <ActivityIndicator color={colors.oxRed} />
          </View>
        ) : sinTiendas ? (
          <Aviso icono="pin" titulo="No encontramos tiendas a tu nombre" texto="Tus tiendas salen del catálogo de asesores de RH. Si te falta alguna, avisa a RH." />
        ) : (
          <>
            {/* Filtros, como el panel de filtros del tablero */}
            <View style={styles.filtros}>
              {tengoTiendas && !soloMisTiendas ? (
                <View style={styles.chips}>
                  <Chip
                    texto="Mis tiendas"
                    activo={soloMias}
                    onPress={() => {
                      setSoloMias(true);
                      setAsesorSel('');
                    }}
                  />
                  <Chip texto="Toda la plaza" activo={!soloMias} onPress={() => setSoloMias(false)} />
                </View>
              ) : null}
              <View style={styles.chips}>
                {!enMisTiendas ? <Selector etiqueta="Asesor" valor={asesorSel} onPress={() => setSelector('asesor')} /> : null}
                <Selector etiqueta="Puesto" valor={puestoSel} onPress={() => setSelector('puesto')} />
                {filtrosActivos ? (
                  <Pressable style={styles.limpiar} onPress={limpiar} accessibilityRole="button">
                    <Icon name="close" size={14} color={TONO.rojo} />
                    <Text style={styles.limpiarTexto}>Limpiar</Text>
                  </Pressable>
                ) : null}
              </View>
              <Text style={styles.contexto}>
                {enMisTiendas ? 'Tus tiendas' : 'Plaza Oaxaca'} · {personas(equipo.length)} · {tiendas} {tiendas === 1 ? 'tienda' : 'tiendas'}
                {kpi ? ` · viendo ${nombreKpi}` : ''}
              </Text>
            </View>

            <Capa titulo="Resumen ejecutivo" proposito="Días de vacaciones pendientes del último corte." primera />
            <View style={styles.kpis}>
              <Kpi tono="azul" icono="user" etiqueta="Colaboradores" valor={num(equipo.length)} nota={`${tiendas} ${tiendas === 1 ? 'tienda' : 'tiendas'}`} />
              <Kpi
                tono="naranja"
                icono="calendar"
                etiqueta="Días pendientes"
                valor={num(totalDias)}
                nota={`${equipo.length ? (totalDias / equipo.length).toLocaleString('es-MX', { maximumFractionDigits: 1 }) : 0} por colaborador`}
              />
              <Kpi
                tono="rojo"
                icono="alert"
                etiqueta="Vencidos ant."
                valor={num(vencidos.length)}
                nota={`${pct(vencidos.length, equipo.length)}% · ${diasCortos(diasVencidos)}`}
                notaTono="rojo"
                activo={kpi === 'vencido'}
                onPress={() => alternar('vencido')}
              />
              <Kpi
                tono="amarillo"
                icono="clock"
                etiqueta="Vencen 0 a 50 días"
                valor={num(pronto.length)}
                nota={`${pct(pronto.length, equipo.length)}% · ${diasCortos(diasPronto)}`}
                notaTono="naranja"
                activo={kpi === 'pronto'}
                onPress={() => alternar('pronto')}
              />
              <Kpi
                tono="verde"
                icono="check"
                etiqueta="Al día"
                valor={num(alDia)}
                nota={`${pct(alDia, equipo.length)}% sin urgencia`}
                notaTono="verde"
                activo={kpi === 'aldia'}
                onPress={() => alternar('aldia')}
              />
              <Kpi tono="gris" icono="pin" etiqueta="Tiendas con vencidos" valor={num(new Set(vencidos.map((v) => v.tienda)).size)} nota={`de ${tiendas}`} />
            </View>
            <Text style={styles.ayudaKpi}>Toca Vencidos, Vencen o Al día para ver solo a esas personas.</Text>

            <Capa titulo="Vencidos y por vencer" proposito="Periodo anterior: los días que se pierden si no se toman." />
            <Tarjeta
              icono="clock"
              titulo="Vencimiento del periodo anterior"
              badge={personas(vista.length)}
              ayuda="Personas por rango de vencimiento de su periodo anterior (columna Bucket_Ant del reporte). Los días son los del periodo anterior."
            >
              <View style={styles.apilada}>
                {porRango
                  .filter((r) => r.personas > 0)
                  .map((r) => (
                    <View key={r.clave} style={{ flex: r.personas, backgroundColor: r.color }} />
                  ))}
              </View>
              {porRango
                .filter((r) => r.personas > 0 || r.clave !== 'na')
                .map((r) => (
                  <View key={r.clave} style={styles.rango}>
                    <View style={[styles.rangoPunto, { backgroundColor: r.color }]} />
                    <Text style={styles.rangoEtq}>{r.etiqueta}</Text>
                    <Text style={styles.rangoDias}>{diasCortos(r.dias)}</Text>
                    <Text style={styles.rangoPersonas}>{num(r.personas)}</Text>
                  </View>
                ))}
            </Tarjeta>
            {responsables.length > 1 ? (
              <Tarjeta
                icono="alert"
                titulo={porResponsable === 'asesor' ? 'Vencidos y por vencer por Asesor' : 'Vencidos y por vencer por Tienda'}
                badge={`${responsables.length} ${porResponsable === 'asesor' ? 'asesores' : 'tiendas'}`}
                ayuda="En rojo los vencidos, en naranja los que vencen en 0 a 50 días y en verde los demás. El porcentaje es la parte que hay que atender."
              >
                <Responsables filas={responsables} />
              </Tarjeta>
            ) : null}

            <Capa titulo="Foco y responsables" proposito="Quién debe tomar sus días primero y dónde se juntan." />
            {atender.length ? (
              <Tarjeta icono="alert" titulo="Atender primero" badge={`${atender.length}`} ayuda="Primero los vencidos y luego los que vencen en 0 a 50 días, de más a menos días del periodo anterior. Toca a alguien para ver su saldo.">
                {(todosUrgentes ? atender : atender.slice(0, 6)).map(fila)}
                {atender.length > 6 ? (
                  <Pressable onPress={() => setTodosUrgentes((x) => !x)} accessibilityRole="button">
                    <Text style={styles.verMas}>{todosUrgentes ? 'Ver menos' : `Ver los ${atender.length}`}</Text>
                  </Pressable>
                ) : null}
              </Tarjeta>
            ) : (
              <Tarjeta icono="check" titulo="Atender primero">
                <Text style={styles.nota}>Nadie tiene días vencidos ni por vencer con estos filtros.</Text>
              </Tarjeta>
            )}
            {porResponsable === 'asesor' && porAsesor.length > 1 ? (
              <Tarjeta icono="user" titulo="Días pendientes por Asesor" badge={`${porAsesor.length} asesores`} ayuda="Suma de días pendientes (periodo anterior + actual) de las personas de cada asesor.">
                <Barras filas={porAsesor} formato={(v) => diasCortos(v)} maxFilas={6} />
              </Tarjeta>
            ) : null}

            <Capa titulo="Exploración detallada" proposito="Tiendas, puestos, rangos y el equipo completo." />
            {porTienda.length > 1 ? (
              <Tarjeta icono="pin" titulo="Tiendas con más días pendientes" badge={`${porTienda.length} tiendas`}>
                <Barras filas={porTienda} formato={(v) => diasCortos(v)} maxFilas={10} />
              </Tarjeta>
            ) : null}
            {porPuesto.length > 1 ? (
              <Tarjeta icono="badge" titulo="Días pendientes por Puesto" badge={`${porPuesto.length} puestos`}>
                <Barras filas={porPuesto} formato={(v) => diasCortos(v)} maxFilas={6} />
              </Tarjeta>
            ) : null}
            <Tarjeta icono="clipboard" titulo="Resumen por rango" ayuda="Cuántas personas hay en cada rango de vencimiento del periodo anterior y cuántos días suman en total.">
              <View style={[styles.tablaFila, styles.linea]}>
                <Text style={[styles.tablaCab, { flex: 1 }]}>Rango</Text>
                <Text style={[styles.tablaCab, styles.tablaNum]}>Personas</Text>
                <Text style={[styles.tablaCab, styles.tablaNum]}>Días</Text>
              </View>
              {porRango
                .filter((r) => r.personas > 0)
                .map((r, i, arr) => {
                  const total = vista.filter((v) => rangoAnt(v).clave === r.clave).reduce((x, v) => x + v.diasRestantes, 0);
                  return (
                    <View key={r.clave} style={[styles.tablaFila, i < arr.length - 1 && styles.linea]}>
                      <View style={[styles.rangoPunto, { backgroundColor: r.color }]} />
                      <Text style={[styles.tablaTxt, { flex: 1 }]}>{r.etiqueta}</Text>
                      <Text style={[styles.tablaTxt, styles.tablaNum]}>{num(r.personas)}</Text>
                      <Text style={[styles.tablaTxt, styles.tablaNum]}>{num(total)}</Text>
                    </View>
                  );
                })}
            </Tarjeta>
            <Tarjeta icono="search" titulo="Detalle completo" badge={`${num(resultado.length)} registros`}>
              <View style={styles.buscador}>
                <Icon name="search" size={18} color={colors.ink3} />
                <TextInput
                  style={styles.buscadorInput}
                  value={texto}
                  onChangeText={setTexto}
                  placeholder="Nombre, número o tienda"
                  placeholderTextColor={colors.ink3}
                  autoCorrect={false}
                  returnKeyType="search"
                />
              </View>
              {resultado.length ? resultado.slice(0, Math.min(cuantos, MAX_LISTA)).map(fila) : <Text style={styles.nota}>Nadie coincide con la búsqueda.</Text>}
              {resultado.length > cuantos && cuantos < MAX_LISTA ? (
                <Pressable onPress={() => setCuantos((c) => c + PASO_DETALLE)} accessibilityRole="button">
                  <Text style={styles.verMas}>Ver {Math.min(PASO_DETALLE, resultado.length - cuantos)} más</Text>
                </Pressable>
              ) : null}
              {resultado.length > MAX_LISTA && cuantos >= MAX_LISTA ? (
                <Text style={styles.nota}>Se muestran {MAX_LISTA}; usa la búsqueda o los filtros para ver los demás.</Text>
              ) : null}
            </Tarjeta>
          </>
        )}
      </ScrollView>
      <Modal visible={!!selector} transparent animationType="fade" onRequestClose={() => setSelector(null)}>
        <Pressable style={styles.velo} onPress={() => setSelector(null)} accessibilityLabel="Cerrar" />
        <View style={styles.hoja}>
          <Text style={styles.hojaTitulo}>{selector === 'asesor' ? 'Filtrar por asesor' : 'Filtrar por puesto'}</Text>
          <ScrollView style={{ maxHeight: 420 }}>
            {selector
              ? [['', base.length] as [string, number], ...opciones(selector)].map(([valor, cuantos]) => {
                  const actual = selector === 'asesor' ? asesorSel : puestoSel;
                  return (
                    <Pressable
                      key={valor || '__todos'}
                      style={[styles.opcion, valor === actual && styles.opcionActiva]}
                      onPress={() => {
                        (selector === 'asesor' ? setAsesorSel : setPuestoSel)(valor);
                        setSelector(null);
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ selected: valor === actual }}
                    >
                      <Text style={[styles.opcionTxt, valor === actual && { color: colors.oxRed }]} numberOfLines={1}>
                        {valor || 'Todos'}
                      </Text>
                      <Text style={styles.opcionNum}>{num(cuantos)}</Text>
                    </Pressable>
                  );
                })
              : null}
          </ScrollView>
        </View>
      </Modal>
      <Modal visible={!!detalle} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDetalle(null)} transparent={false}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>Saldo de vacaciones</Text>
              <Text style={styles.title} numberOfLines={1}>
                {detalle?.nombre}
              </Text>
            </View>
            <Pressable style={styles.headerButton} onPress={() => setDetalle(null)} accessibilityLabel="Cerrar">
              <Icon name="close" size={20} color={colors.ink} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.content}>{detalle ? <Saldo v={detalle} compacto /> : null}</ScrollView>
        </SafeAreaView>
      </Modal>
      {pin.modal}
    </>
  );
}

// Encabezado de capa del tablero: etiqueta en mayúsculas y una línea de propósito.
function Capa({ titulo, proposito, primera }: { titulo: string; proposito: string; primera?: boolean }) {
  return (
    <View style={[styles.capa, primera && styles.capaPrimera]} accessibilityRole="header">
      <Text style={styles.capaTitulo}>{titulo}</Text>
      <Text style={styles.capaProposito}>{proposito}</Text>
    </View>
  );
}

// Tarjeta de indicador con borde de color (kpi-card del tablero). Si se puede
// tocar, filtra lo de abajo y se marca con ✓.
function Kpi({
  tono,
  icono,
  etiqueta,
  valor,
  nota,
  notaTono,
  activo,
  onPress,
}: {
  tono: Tono;
  icono: string;
  etiqueta: string;
  valor: string;
  nota: string;
  notaTono?: Tono;
  activo?: boolean;
  onPress?: () => void;
}) {
  const color = TONO[tono];
  const cuerpo = (
    <>
      <View style={styles.kpiTop}>
        <Text style={styles.kpiEtq} numberOfLines={2}>
          {etiqueta}
        </Text>
        <Icon name={icono} size={16} color={color} />
      </View>
      <Text style={styles.kpiValor} numberOfLines={1} adjustsFontSizeToFit>
        {valor}
      </Text>
      <Text style={[styles.kpiNota, notaTono ? { color: TONO[notaTono] } : null]} numberOfLines={2}>
        {nota}
      </Text>
      {activo ? (
        <View style={[styles.kpiCheck, { backgroundColor: color }]}>
          <Icon name="check" size={12} color={colors.white} />
        </View>
      ) : null}
    </>
  );
  const estilo = [styles.kpi, { borderLeftColor: color }, activo && { borderColor: color, borderWidth: 2, borderLeftWidth: 4, backgroundColor: '#FFFAF6' }];
  return onPress ? (
    <Pressable style={estilo} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: !!activo }} accessibilityLabel={`${etiqueta}: ${valor}`}>
      {cuerpo}
    </Pressable>
  ) : (
    <View style={estilo}>{cuerpo}</View>
  );
}

// Tarjeta con encabezado (ícono, título y contador) y una ayuda que se abre con ⓘ.
function Tarjeta({ icono, titulo, badge, ayuda, children }: { icono: string; titulo: string; badge?: string; ayuda?: string; children: React.ReactNode }) {
  const [verAyuda, setVerAyuda] = useState(false);
  return (
    <View style={styles.card}>
      <View style={styles.tarjetaHead}>
        <Icon name={icono} size={17} color={colors.oxRed} />
        <Text style={styles.tarjetaTitulo} numberOfLines={2}>
          {titulo}
        </Text>
        {ayuda ? (
          <Pressable onPress={() => setVerAyuda((x) => !x)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Qué muestra ${titulo}`}>
            <Icon name="help" size={16} color={verAyuda ? colors.oxRed : colors.ink3} />
          </Pressable>
        ) : null}
        <View style={{ flex: 1 }} />
        {badge ? (
          <Text style={styles.badge} numberOfLines={1}>
            {badge}
          </Text>
        ) : null}
      </View>
      {verAyuda && ayuda ? <Text style={styles.ayuda}>{ayuda}</Text> : null}
      <View style={{ gap: 10 }}>{children}</View>
    </View>
  );
}

// Filas apiladas rojo / naranja / verde con el % a atender (como "No
// justificados por Asesor").
function Responsables({ filas }: { filas: Array<{ nombre: string; vencido: number; pronto: number; total: number; dias: number }> }) {
  const [todas, setTodas] = useState(false);
  const visibles = todas ? filas : filas.slice(0, 8);
  return (
    <View style={{ gap: 12 }}>
      {visibles.map((f) => {
        const resto = f.total - f.vencido - f.pronto;
        return (
          <View key={f.nombre} style={{ gap: 5 }}>
            <View style={styles.respTop}>
              <Text style={styles.respNombre} numberOfLines={1}>
                {f.nombre}
              </Text>
              <Text style={[styles.respPct, { color: f.vencido ? TONO.rojo : f.pronto ? TONO.naranja : TONO.verde }]}>{pct(f.vencido + f.pronto, f.total)}%</Text>
            </View>
            <View style={styles.respBarra}>
              {f.vencido ? <View style={{ flex: f.vencido, backgroundColor: TONO.rojo }} /> : null}
              {f.pronto ? <View style={{ flex: f.pronto, backgroundColor: '#F06A24' }} /> : null}
              {resto ? <View style={{ flex: resto, backgroundColor: '#8CCFAE' }} /> : null}
            </View>
            <Text style={styles.respDetalle}>
              {f.vencido} {f.vencido === 1 ? 'vencido' : 'vencidos'} · {f.pronto} por vencer · {personas(f.total)}
            </Text>
          </View>
        );
      })}
      {filas.length > 8 ? (
        <Pressable onPress={() => setTodas((x) => !x)} accessibilityRole="button">
          <Text style={styles.verMas}>{todas ? 'Ver menos' : `Ver los ${filas.length}`}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// Botón de filtro: "Asesor: Todos ▾".
function Selector({ etiqueta, valor, onPress }: { etiqueta: string; valor: string; onPress: () => void }) {
  return (
    <Pressable style={[styles.chip, styles.selector, !!valor && styles.selectorActivo]} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${etiqueta}: ${valor || 'Todos'}`}>
      <Text style={[styles.chipText, !!valor && { color: colors.oxRed }]} numberOfLines={1}>
        {etiqueta}: {valor || 'Todos'}
      </Text>
      <View style={{ transform: [{ rotate: '90deg' }] }}>
        <Icon name="chevR" size={13} color={valor ? colors.oxRed : colors.ink3} />
      </View>
    </Pressable>
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
  anilloFila: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  anilloNum: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 28, color: colors.ink },
  anilloTxt: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: colors.ink3, marginTop: -2 },
  venceTxt: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11.5, color: colors.ink3, marginTop: 3, marginLeft: 18 },
  cardTitle: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 16, color: colors.ink, marginBottom: 10 },
  linea: { borderBottomWidth: 1, borderBottomColor: colors.line },
  personaBarra: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  verMas: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 13, color: colors.oxRed, paddingVertical: 6 },
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
  segmento: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.field,
    borderWidth: 1,
    borderColor: colors.line,
  },
  segBoton: { flex: 1, paddingVertical: 9, borderRadius: radii.pill, alignItems: 'center' },
  segActivo: { backgroundColor: colors.white, ...shadows.card },
  segTexto: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13.5, color: colors.ink2 },
  segTextoActivo: { color: colors.oxRed },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 12 },
  cargando: { paddingVertical: 48, alignItems: 'center' },
  nota: { ...type.caption, color: colors.ink2 },
  hero: { borderRadius: 24, padding: 20, ...shadows.hero },
  heroKicker: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 12, color: 'rgba(255,255,255,.84)', textTransform: 'uppercase' },
  heroNumero: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 64, lineHeight: 72, color: colors.white, marginTop: 4 },
  heroBody: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: colors.white, marginTop: -4 },
  heroMeta: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12.5, color: 'rgba(255,255,255,.86)', marginTop: 10 },
  alerta: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: radii.xl,
    backgroundColor: '#FFF6E0',
    borderWidth: 1,
    borderColor: '#F5D98A',
  },
  alertaVencido: { backgroundColor: '#FFF0EC', borderColor: '#FFD2C4' },
  alertaTexto: { flex: 1, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13.5, lineHeight: 19, color: colors.ink },
  fila: { flexDirection: 'row', gap: 10 },
  card: {
    borderRadius: radii.xl,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    ...shadows.card,
  },
  periodo: { flex: 1, padding: 14 },
  periodoTitulo: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12.5, color: colors.ink2 },
  periodoValor: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 22, color: colors.ink, marginTop: 4 },
  periodoVence: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, lineHeight: 16, color: colors.ink3, marginTop: 6 },
  dato: { paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  datoLinea: { borderBottomWidth: 1, borderBottomColor: colors.line },
  datoEtq: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: colors.ink2 },
  datoValor: { flexShrink: 1, textAlign: 'right', fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: colors.ink },
  aviso: { alignItems: 'center', gap: 8, paddingVertical: 28 },
  avisoTitulo: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 16, color: colors.ink, textAlign: 'center' },
  avisoTexto: { ...type.caption, color: colors.ink2, textAlign: 'center', maxWidth: 300 },
  avisoBoton: { marginTop: 6, paddingHorizontal: 18, paddingVertical: 10, borderRadius: radii.pill, backgroundColor: colors.oxRed },
  avisoBotonTexto: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13.5, color: colors.white },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filtros: { gap: 10, padding: 12, borderRadius: radii.xl, backgroundColor: 'rgba(255,255,255,.7)', borderWidth: 1, borderColor: colors.line },
  contexto: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: colors.ink2 },
  selector: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.white, maxWidth: '100%' },
  selectorActivo: { borderColor: colors.oxRed, backgroundColor: '#FFF0EC' },
  limpiar: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 9 },
  limpiarTexto: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 13, color: '#D91F2D' },
  capa: { marginTop: 10, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.line, gap: 2 },
  capaPrimera: { marginTop: 2, paddingTop: 0, borderTopWidth: 0 },
  capaTitulo: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 11, letterSpacing: 1.3, textTransform: 'uppercase', color: colors.oxRedDark },
  capaProposito: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: colors.ink2 },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpi: {
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 104,
    gap: 4,
    padding: 12,
    paddingLeft: 14,
    borderRadius: radii.lg,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderLeftWidth: 4,
    ...shadows.card,
  },
  kpiTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  kpiEtq: { flex: 1, fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 11, letterSpacing: 0.4, textTransform: 'uppercase', color: colors.ink2 },
  kpiValor: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 30, lineHeight: 36, color: colors.ink },
  kpiNota: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11.5, color: colors.ink3 },
  kpiCheck: { position: 'absolute', top: -8, right: -8, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  ayudaKpi: { ...type.caption, color: colors.ink3, marginTop: -4 },
  tarjetaHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  tarjetaTitulo: { flexShrink: 1, fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 15, color: colors.ink },
  badge: { flexShrink: 0, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11.5, color: colors.ink2, backgroundColor: colors.field, paddingHorizontal: 9, paddingVertical: 4, borderRadius: radii.pill, overflow: 'hidden' },
  ayuda: { ...type.caption, color: colors.ink2, backgroundColor: colors.field, padding: 10, borderRadius: radii.md, marginTop: -4, marginBottom: 12, overflow: 'hidden' },
  apilada: { flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', backgroundColor: colors.field, marginBottom: 4 },
  rango: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rangoPunto: { width: 10, height: 10, borderRadius: 5 },
  rangoEtq: { flex: 1, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: colors.ink2 },
  rangoDias: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: colors.ink3 },
  rangoPersonas: { minWidth: 34, textAlign: 'right', fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 13.5, color: colors.ink },
  respTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  respNombre: { flex: 1, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: colors.ink },
  respPct: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 13 },
  respBarra: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', backgroundColor: colors.field },
  respDetalle: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11.5, color: colors.ink3 },
  tablaFila: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9 },
  tablaCab: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 11, letterSpacing: 0.4, textTransform: 'uppercase', color: colors.ink3 },
  tablaTxt: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: colors.ink },
  tablaNum: { minWidth: 64, textAlign: 'right' },
  velo: { flex: 1, backgroundColor: 'rgba(36,26,23,.35)' },
  hoja: { backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, paddingBottom: 28, gap: 8 },
  hojaTitulo: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 16, color: colors.ink, marginBottom: 4 },
  opcion: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 12, borderRadius: radii.md },
  opcionActiva: { backgroundColor: '#FFF0EC' },
  opcionTxt: { flex: 1, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: colors.ink },
  opcionNum: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12.5, color: colors.ink3 },
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
  persona: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  personaNombre: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 14.5, color: colors.ink },
  personaMeta: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: colors.ink2, marginTop: 2 },
  personaAlerta: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11.5, color: '#B7791F', marginTop: 4 },
  personaDias: { alignItems: 'center', minWidth: 48 },
  personaNumero: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 15, color: colors.ink },
  personaUnidad: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: colors.ink3 },
});
