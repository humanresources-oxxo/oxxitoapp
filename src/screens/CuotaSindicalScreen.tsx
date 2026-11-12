// src/screens/CuotaSindicalScreen.tsx
// Cuota sindical: what was withheld each month in Plaza Oaxaca, from
// DashboardsOxxo's Cuota Sindical dashboard. Totals only (no names). The
// month's amount, a tappable column per month, a ring by puesto and, folded,
// by AT and by store. Asesores de Tienda only see their own stores.
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Pressable } from '../components/Pressable';
import { LinearGradient } from 'expo-linear-gradient';
import { Esqueleto } from '../components/Estado';
import { Encabezado } from '../components/Encabezado';
import { Icon } from '../components/Icon';
import { usePinDeSesion } from '../components/PinDeSesion';
import { Anillo, Barras, Columnas, Delta, Desplegable, Leyenda } from '../components/Visual';
import { getJson, storageKeys } from '../services/appStorage';
import { agrupar, cargarCuota, Cuota, suma } from '../services/cuotaSindical';
import { normalizarNombre } from '../services/gviz';
import { colors, gradients, radii, shadows, type, fontFamily } from '../theme/tokens';

type Sesion = { nombre?: string } | null;

const MAX_TIENDAS = 60;
const NOMBRES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const mesLargo = (m: string) => (m ? `${NOMBRES[+m.slice(5) - 1]} ${m.slice(0, 4)}` : '');
const mesCorto = (m: string) => (m ? `${CORTOS[+m.slice(5) - 1]} ${m.slice(2, 4)}` : '');
const dinero = (v: number) => `$${Math.round(v).toLocaleString('es-MX')}`;
function compacto(v: number) {
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toLocaleString('es-MX', { maximumFractionDigits: 1 })} M`;
  if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toLocaleString('es-MX', { maximumFractionDigits: 1 })} k`;
  return dinero(v);
}
const num = (n: number) => n.toLocaleString('es-MX');
// "AYUDANTE TIENDA SIND" -> "Ayudante Tienda Sind"; "OXXO" stays.
const titulo = (s: string) =>
  s
    .split(' ')
    .map((w) => (/^(OXXO|AT|CV|II|III|IV|VSA|OAX)$/i.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(' ');

export function CuotaSindicalScreen({ onBack, soloMisTiendas = false }: { onBack: () => void; soloMisTiendas?: boolean }) {
  const [sesion, setSesion] = useState<Sesion>(null);
  const [cuota, setCuota] = useState<Cuota | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [intento, setIntento] = useState(0);
  const pin = usePinDeSesion(() => setIntento((i) => i + 1));
  const [mes, setMes] = useState('');
  const [texto, setTexto] = useState('');

  useEffect(() => {
    getJson<Sesion>(storageKeys.session, null).then(setSesion);
  }, []);
  useEffect(() => {
    let activo = true;
    setCuota(null);
    setError(null);
    cargarCuota()
      .then((c) => {
        if (!activo) return;
        setCuota(c);
        setMes((m) => m || c.meses[c.meses.length - 1] || '');
      })
      .catch((e) => activo && setError(e ?? true));
    return () => {
      activo = false;
    };
  }, [intento]);

  // An AT only sees their own stores (and nothing if their name isn't found).
  const yo = normalizarNombre(sesion?.nombre);
  const base = useMemo(() => {
    const todo = cuota?.detalle || [];
    if (!soloMisTiendas) return todo;
    return yo ? todo.filter((f) => normalizarNombre(f.asesor) === yo) : [];
  }, [cuota, soloMisTiendas, yo]);
  const sinTiendas = soloMisTiendas && !!cuota && !base.length;

  const meses = cuota?.meses || [];
  const delMes = useMemo(() => base.filter((f) => f.mes === mes), [base, mes]);
  const importe = suma(delMes, 'importe');
  const iMes = meses.indexOf(mes);
  const previo = iMes > 0 ? suma(base.filter((f) => f.mes === meses[iMes - 1]), 'importe') : null;
  // Exact people only for the whole plaza (Resumen); for an AT, the sum by
  // store and puesto (someone in two stores counts twice).
  const res = !soloMisTiendas ? cuota?.resumen.find((r) => r.mes === mes) : undefined;
  const personas = res ? res.personas - res.sinDescuento : suma(delMes, 'personas');
  const ajustes = suma(delMes, 'devoluciones') + suma(delMes, 'reversos');

  const tendencia = useMemo(() => meses.map((m) => ({ mes: m, importe: suma(base.filter((f) => f.mes === m), 'importe') })), [meses, base]);
  const porAsesor = useMemo(() => agrupar(delMes, 'asesor'), [delMes]);
  const porPuesto = useMemo(() => agrupar(delMes, 'funcion'), [delMes]);
  const tiendas = useMemo(() => {
    const n = normalizarNombre(texto);
    const g = agrupar(delMes, 'tienda');
    const at = new Map(delMes.map((f) => [f.tienda, f.asesor]));
    return g
      .map((t) => ({ ...t, asesor: at.get(t.nombre) || '' }))
      .filter((t) => !n || normalizarNombre(`${t.nombre} ${t.asesor}`).includes(n));
  }, [delMes, texto]);
  // Ring of the four puestos with the most withheld, the rest together.
  const COLORES = [colors.oxRed, colors.oxBlue, colors.oxGold, colors.ok, colors.ink3];
  const anillo = [...porPuesto.slice(0, 4), ...(porPuesto.length > 4 ? [{ ...porPuesto[4], nombre: 'Otros', importe: porPuesto.slice(4).reduce((x, g) => x + g.importe, 0) }] : [])];
  const pct = (v: number) => (importe ? `${Math.round((v / importe) * 100)}%` : '0%');
  const delta = previo ? ((importe - previo) / previo) * 100 : null;

  return (
    <View style={styles.screen}>
      <LinearGradient colors={gradients.fondo.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <Encabezado titulo="Cuota sindical" eyebrow={`Plaza Oaxaca${cuota?.cargadoEl ? ` · ${cuota.cargadoEl}` : ''}`} onBack={onBack} />

      {error ? (
        <View style={styles.content}>
          <Aviso
            {...pin.aviso(error, {
              titulo: 'No se pudo cargar la cuota sindical',
              texto: 'Revisa tu conexión e intenta de nuevo.',
              accion: { texto: 'Reintentar', onPress: () => setIntento((i) => i + 1) },
            })}
          />
        </View>
      ) : !cuota ? (
        <View style={{ padding: 16 }}>
          <Esqueleto />
        </View>
      ) : !meses.length ? (
        <View style={styles.content}>
          <Aviso titulo="Todavía no hay datos" texto="RH aún no ha cargado el reporte de cuota sindical." />
        </View>
      ) : sinTiendas ? (
        <View style={styles.content}>
          <Aviso titulo="No encontramos tiendas a tu nombre" texto="Tus tiendas salen del catálogo de asesores de RH. Si te falta alguna, avisa a RH." />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <LinearGradient colors={gradients.oxGrad.colors} start={gradients.oxGrad.start} end={gradients.oxGrad.end} style={styles.hero}>
            <Text style={styles.heroKicker}>
              Descontado · {mesLargo(mes)}
              {soloMisTiendas ? ' · tus tiendas' : ''}
            </Text>
            <Text style={styles.heroNumero}>{dinero(importe)}</Text>
            {delta !== null ? (
              <Delta valor={delta} texto={`${Math.abs(delta).toLocaleString('es-MX', { maximumFractionDigits: 1 })}% vs ${mesCorto(meses[iMes - 1])}`} />
            ) : (
              <Text style={styles.heroBody}>Primer mes con datos</Text>
            )}
          </LinearGradient>

          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.cardTitle}>Por mes</Text>
              <Text style={styles.cardHint}>Toca un mes</Text>
            </View>
            <Columnas
              datos={tendencia.map((t) => ({ clave: t.mes, etiqueta: CORTOS[+t.mes.slice(5) - 1], valor: t.importe }))}
              seleccion={mes}
              onSelect={setMes}
              formato={(v) => `${mesCorto(mes)}: ${compacto(v)}`}
            />
          </View>

          <View style={styles.fila}>
            <Dato titulo="Personas" valor={num(personas)} nota={res ? 'con descuento' : 'por tienda y puesto'} />
            <Dato titulo="Promedio" valor={personas ? dinero(importe / personas) : '—'} nota="por persona" />
            <Dato titulo="Ajustes" valor={num(ajustes)} nota="devol. y reversos" />
          </View>

          {porPuesto.length ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Por puesto</Text>
              <View style={styles.anilloFila}>
                <Anillo
                  segmentos={anillo.map((g, i) => ({ valor: g.importe, color: COLORES[i] }))}
                  centro={
                    <View style={{ alignItems: 'center' }}>
                      <Text style={styles.anilloNum}>{compacto(importe)}</Text>
                      <Text style={styles.anilloTxt}>{mesCorto(mes)}</Text>
                    </View>
                  }
                />
                <View style={{ flex: 1 }}>
                  <Leyenda items={anillo.map((g, i) => ({ etiqueta: titulo(g.nombre), valor: pct(g.importe), color: COLORES[i] }))} />
                </View>
              </View>
            </View>
          ) : null}

          {!soloMisTiendas && porAsesor.length ? (
            <Desplegable titulo="Por asesor" icono="user" resumen={`${titulo(porAsesor[0].nombre)} encabeza con ${compacto(porAsesor[0].importe)} · ${porAsesor.length} asesores`}>
              <Barras
                filas={porAsesor.map((g) => ({ etiqueta: titulo(g.nombre), valor: g.importe, detalle: `${g.tiendas} tiendas · ${num(g.personas)} personas` }))}
                formato={compacto}
                maxFilas={5}
              />
            </Desplegable>
          ) : null}

          <Desplegable
            titulo={soloMisTiendas ? 'Tus tiendas' : 'Por tienda'}
            icono="pin"
            resumen={tiendas.length ? `${num(tiendas.length)} tiendas · la mayor, ${titulo(tiendas[0].nombre)} (${compacto(tiendas[0].importe)})` : 'Sin tiendas en este mes'}
          >
            <View style={styles.buscador}>
              <Icon name="search" size={18} color={colors.ink3} />
              <TextInput
                style={styles.buscadorInput}
                value={texto}
                onChangeText={setTexto}
                placeholder={soloMisTiendas ? 'Buscar tienda' : 'Tienda o asesor'}
                placeholderTextColor={colors.placeholder}
                autoCorrect={false}
                returnKeyType="search"
              />
            </View>
            {tiendas.length ? (
              tiendas.slice(0, MAX_TIENDAS).map((t, i, arr) => (
                <View key={t.nombre} style={[styles.tienda, i < arr.length - 1 && styles.linea]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tiendaNombre} numberOfLines={1}>
                      {titulo(t.nombre)}
                    </Text>
                    <Text style={styles.tiendaMeta} numberOfLines={1}>
                      {!soloMisTiendas ? `${titulo(t.asesor)} · ` : ''}
                      {num(t.personas)} {t.personas === 1 ? 'persona' : 'personas'}
                    </Text>
                  </View>
                  <Text style={styles.tiendaImporte}>{dinero(t.importe)}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.nota}>Ninguna tienda coincide con la búsqueda.</Text>
            )}
            {tiendas.length > MAX_TIENDAS ? <Text style={styles.nota}>Se muestran {MAX_TIENDAS}; usa la búsqueda para ver las demás.</Text> : null}
          </Desplegable>

          <Text style={styles.nota}>Por privacidad no se publican nombres: para saber quiénes son, revisa el reporte de nómina.</Text>
        </ScrollView>
      )}
      {pin.modal}
    </View>
  );
}

function Dato({ titulo, valor, nota }: { titulo: string; valor: string; nota: string }) {
  return (
    <View style={[styles.card, styles.dato]}>
      <Text style={styles.datoTitulo}>{titulo}</Text>
      <Text style={styles.datoValor} numberOfLines={1} adjustsFontSizeToFit>
        {valor}
      </Text>
      <Text style={styles.datoNota}>{nota}</Text>
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
        <Pressable accessibilityRole="button" style={styles.avisoBoton} onPress={accion.onPress}>
          <Text style={styles.avisoBotonTexto}>{accion.texto}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}


const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 12 },
  nota: { ...type.caption, color: colors.ink2 },
  hero: { borderRadius: 24, padding: 20, ...shadows.hero },
  heroKicker: { fontFamily: fontFamily.extrabold, fontSize: 12, color: 'rgba(255,255,255,.84)', textTransform: 'uppercase' },
  heroNumero: { fontFamily: fontFamily.extrabold, fontSize: 40, lineHeight: 48, color: colors.white, marginTop: 4 },
  heroBody: { fontFamily: fontFamily.bold, fontSize: 13.5, color: 'rgba(255,255,255,.92)', marginTop: 2 },
  fila: { flexDirection: 'row', gap: 10 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  cardHint: { fontFamily: fontFamily.semibold, fontSize: 12, color: colors.ink3 },
  anilloFila: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  anilloNum: { fontFamily: fontFamily.extrabold, fontSize: 16, color: colors.ink },
  anilloTxt: { fontFamily: fontFamily.bold, fontSize: 12, color: colors.ink3 },
  linea: { borderBottomWidth: 1, borderBottomColor: colors.line },
  card: {
    borderRadius: radii.xl,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    ...shadows.card,
  },
  cardTitle: { fontFamily: fontFamily.extrabold, fontSize: 16, color: colors.ink, marginBottom: 10 },
  dato: { flex: 1, padding: 12 },
  datoTitulo: { fontFamily: fontFamily.bold, fontSize: 12, color: colors.ink2 },
  datoValor: { fontFamily: fontFamily.extrabold, fontSize: 19, color: colors.ink, marginTop: 4 },
  datoNota: { fontFamily: fontFamily.semibold, fontSize: 12, color: colors.ink3, marginTop: 2 },
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
  buscadorInput: { flex: 1, fontFamily: fontFamily.semibold, fontSize: 15, color: colors.ink, paddingVertical: 12 },
  tienda: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  tiendaNombre: { fontFamily: fontFamily.extrabold, fontSize: 14.5, color: colors.ink },
  tiendaMeta: { fontFamily: fontFamily.semibold, fontSize: 12, color: colors.ink2, marginTop: 2 },
  tiendaImporte: { fontFamily: fontFamily.extrabold, fontSize: 15, color: colors.oxRed },
  aviso: { alignItems: 'center', gap: 8, paddingVertical: 28 },
  avisoTitulo: { fontFamily: fontFamily.extrabold, fontSize: 16, color: colors.ink, textAlign: 'center' },
  avisoTexto: { ...type.caption, color: colors.ink2, textAlign: 'center', maxWidth: 300 },
  avisoBoton: { marginTop: 6, paddingHorizontal: 18, paddingVertical: 10, borderRadius: radii.pill, backgroundColor: colors.oxRed },
  avisoBotonTexto: { fontFamily: fontFamily.bold, fontSize: 13.5, color: colors.white },

});
