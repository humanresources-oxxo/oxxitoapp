// src/screens/VacacionesScreen.tsx
// Vacaciones: the employee's own balance (a ring with the previous and current
// period and when they expire) from DashboardsOxxo's Dashboard 5. Puestos with
// team access (same as Actas) also get "Mi equipo": days pending, who must take
// them first and, folded, by store and the whole team (an AT: only their stores).
// Plaza Oaxaca only (see services/gviz.ts).
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { Anillo, BarraApilada, Barras, Desplegable, Leyenda } from '../components/Visual';
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
  const [errorMia, setErrorMia] = useState(false);
  const [actualizado, setActualizado] = useState('');
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let activo = true;
    setErrorMia(false);
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
        .catch(() => activo && setErrorMia(true));
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
              titulo="No se pudo cargar tu saldo"
              texto="Revisa tu conexión e intenta de nuevo."
              accion={{ texto: 'Reintentar', onPress: () => setIntento((i) => i + 1) }}
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

function Equipo({ sesion, soloMisTiendas }: { sesion: Sesion; soloMisTiendas: boolean }) {
  const [filas, setFilas] = useState<Vacacion[] | null>(null);
  const [error, setError] = useState(false);
  const [texto, setTexto] = useState('');
  const [soloMias, setSoloMias] = useState(true);
  const [urgentes, setUrgentes] = useState(false);
  const [todosUrgentes, setTodosUrgentes] = useState(false);
  const [detalle, setDetalle] = useState<Vacacion | null>(null);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let activo = true;
    setFilas(null);
    setError(false);
    cargarEquipo()
      .then((l) => activo && setFilas(l))
      .catch(() => activo && setError(true));
    return () => {
      activo = false;
    };
  }, [intento]);

  // An AT only sees their own stores (and nothing if their name isn't found).
  // Others get an optional "Mis tiendas" when they are the AT of some rows.
  const yo = normalizarNombre(sesion?.nombre);
  const tengoTiendas = useMemo(() => !!yo && !!filas?.some((f) => normalizarNombre(f.asesor) === yo), [filas, yo]);
  const resultado = useMemo(() => {
    if (soloMisTiendas && !yo) return [];
    const filtro = soloMisTiendas || (tengoTiendas && soloMias) ? sesion?.nombre : undefined;
    const base = buscarVacaciones(filas || [], texto, filtro);
    return urgentes ? base.filter((v) => urgencia(v)) : base;
  }, [filas, texto, tengoTiendas, soloMias, soloMisTiendas, yo, urgentes, sesion?.nombre]);
  const sinTiendas = soloMisTiendas && !!filas && !tengoTiendas;
  // The team the summary talks about: the AT's stores (or "Mis tiendas"), before search and filters.
  const equipo = useMemo(() => {
    if (soloMisTiendas && !yo) return [];
    const filtro = soloMisTiendas || (tengoTiendas && soloMias) ? sesion?.nombre : undefined;
    return buscarVacaciones(filas || [], '', filtro);
  }, [filas, tengoTiendas, soloMias, soloMisTiendas, yo, sesion?.nombre]);
  const totalDias = equipo.reduce((x, v) => x + v.diasRestantes, 0);
  const vencidos = equipo.filter((v) => urgencia(v) === 'vencido');
  const pronto = equipo.filter((v) => urgencia(v) === 'pronto');
  const atender = [...vencidos, ...pronto].sort((a, b) => b.periodoAnterior - a.periodoAnterior);
  const porTienda = useMemo(() => {
    const m = new Map<string, { dias: number; personas: number }>();
    equipo.forEach((v) => {
      const t = m.get(v.tienda) || { dias: 0, personas: 0 };
      t.dias += v.diasRestantes;
      t.personas += 1;
      m.set(v.tienda, t);
    });
    return [...m].map(([tienda, t]) => ({ etiqueta: tienda, valor: t.dias, detalle: `${t.personas} ${t.personas === 1 ? 'persona' : 'personas'}` })).sort((a, b) => b.valor - a.valor);
  }, [equipo]);
  const fila = (item: Vacacion, i: number, arr: Vacacion[]) => {
    const u = urgencia(item);
    return (
      <Pressable key={item.numEmpleado} style={[styles.persona, i < arr.length - 1 && styles.linea]} onPress={() => setDetalle(item)}>
        <View style={[styles.personaBarra, { backgroundColor: u === 'vencido' ? colors.oxRed : u === 'pronto' ? colors.oxGold : colors.ok }]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.personaNombre} numberOfLines={1}>
            {item.nombre}
          </Text>
          <Text style={styles.personaMeta} numberOfLines={1}>
            {u === 'vencido' ? 'Periodo anterior vencido · ' : u === 'pronto' ? `Vence en ${item.venceAnterior.toLowerCase()} · ` : ''}
            {item.tienda}
          </Text>
        </View>
        <Text style={styles.personaNumero}>{Number.isInteger(item.diasRestantes) ? item.diasRestantes : item.diasRestantes.toFixed(1)} d</Text>
      </Pressable>
    );
  };

  return (
    <>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {error ? (
          <Aviso
            icono="alert"
            titulo="No se pudo cargar el equipo"
            texto="Revisa tu conexión e intenta de nuevo."
            accion={{ texto: 'Reintentar', onPress: () => setIntento((i) => i + 1) }}
          />
        ) : !filas ? (
          <View style={styles.cargando}>
            <ActivityIndicator color={colors.oxRed} />
          </View>
        ) : sinTiendas ? (
          <Aviso icono="pin" titulo="No encontramos tiendas a tu nombre" texto="Tus tiendas salen del catálogo de asesores de RH. Si te falta alguna, avisa a RH." />
        ) : (
          <>
            {tengoTiendas && !soloMisTiendas ? (
              <View style={styles.chips}>
                <Chip texto="Mis tiendas" activo={soloMias} onPress={() => setSoloMias(true)} />
                <Chip texto="Toda la plaza" activo={!soloMias} onPress={() => setSoloMias(false)} />
              </View>
            ) : null}
            <LinearGradient colors={gradients.oxGrad.colors} start={gradients.oxGrad.start} end={gradients.oxGrad.end} style={styles.hero}>
              <Text style={styles.heroKicker}>{soloMisTiendas || (tengoTiendas && soloMias) ? 'Tus tiendas' : 'Plaza Oaxaca'}</Text>
              <Text style={styles.heroNumero}>{Math.round(totalDias).toLocaleString('es-MX')}</Text>
              <Text style={styles.heroBody}>días de vacaciones pendientes</Text>
              <Text style={styles.heroMeta}>
                {equipo.length.toLocaleString('es-MX')} colaboradores · {equipo.length ? (totalDias / equipo.length).toLocaleString('es-MX', { maximumFractionDigits: 1 }) : 0} días en promedio
              </Text>
            </LinearGradient>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Periodo anterior</Text>
              <BarraApilada
                segmentos={[
                  { etiqueta: 'Ya vencido', valor: vencidos.length, color: colors.oxRed, texto: `${vencidos.length} personas` },
                  { etiqueta: 'Vence en 0 a 50 días', valor: pronto.length, color: colors.oxGold, texto: `${pronto.length} personas` },
                  { etiqueta: 'Sin urgencia', valor: equipo.length - vencidos.length - pronto.length, color: colors.ok, texto: `${equipo.length - vencidos.length - pronto.length} personas` },
                ]}
              />
            </View>

            {atender.length ? (
              <Desplegable titulo="Atender primero" icono="alert" inicial resumen={`${vencidos.length} vencidos · ${pronto.length} vencen pronto`}>
                {(todosUrgentes ? atender : atender.slice(0, 6)).map(fila)}
                {atender.length > 6 ? (
                  <Pressable onPress={() => setTodosUrgentes((x) => !x)} accessibilityRole="button">
                    <Text style={styles.verMas}>{todosUrgentes ? 'Ver menos' : `Ver los ${atender.length}`}</Text>
                  </Pressable>
                ) : null}
              </Desplegable>
            ) : null}

            {porTienda.length > 1 ? (
              <Desplegable titulo="Por tienda" icono="pin" resumen={`${porTienda.length} tiendas · ${porTienda[0].etiqueta} tiene más días (${Math.round(porTienda[0].valor)})`}>
                <Barras filas={porTienda} formato={(v) => dias(Math.round(v))} maxFilas={5} />
              </Desplegable>
            ) : null}

            <Desplegable titulo="Todo el equipo" icono="user" resumen={`${equipo.length} colaboradores · busca por nombre, número o tienda`}>
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
              <View style={styles.chips}>
                <Chip texto="Todos" activo={!urgentes} onPress={() => setUrgentes(false)} />
                <Chip texto="Por vencer o vencidos" activo={urgentes} onPress={() => setUrgentes(true)} />
              </View>
              {resultado.length ? resultado.slice(0, MAX_LISTA).map(fila) : <Text style={styles.nota}>Nadie coincide con la búsqueda.</Text>}
              {resultado.length > MAX_LISTA ? <Text style={styles.nota}>Se muestran {MAX_LISTA}; usa la búsqueda para ver los demás.</Text> : null}
            </Desplegable>
          </>
        )}
      </ScrollView>
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
    </>
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
