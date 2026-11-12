// src/screens/EstructuraScreen.tsx
// Estructura: each store's positions from DashboardsOxxo's Dashboard 1, who
// holds each one and which are vacant (and since when). Plaza Oaxaca only:
// vacancies, a coverage ring, vacancies by puesto, the stores with vacancies
// and, folded, every store (search by store, CR or employee), plus an Excel
// download of every position in view.
// Only for the same puestos as Actas (see services/actas.ts).
import React, { useEffect, useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Pressable } from '../components/Pressable';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Esqueleto } from '../components/Estado';
import { Encabezado } from '../components/Encabezado';
import { Icon } from '../components/Icon';
import { usePinDeSesion } from '../components/PinDeSesion';
import { Anillo, Barras, Desplegable, Leyenda } from '../components/Visual';
import { getJson, storageKeys } from '../services/appStorage';
import {
  buscarTiendas,
  cargarEstructura,
  Corte,
  diasVacante,
  excelEstructura,
  fechaActualizacion,
  mesTexto,
  TiendaEstructura,
  totales,
} from '../services/estructura';
import { normalizarNombre } from '../services/gviz';
import { showAlert } from '../utils/alert';
import { compartirArchivo, MIME } from '../utils/compartir';
import { colors, gradients, radii, shadows, type, fontFamily } from '../theme/tokens';

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
// "AYUDANTE TIENDA" -> "Ayudante tienda"
const titulo = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

// soloMisTiendas: Asesores de Tienda only see their own stores.
export function EstructuraScreen({ onBack, soloMisTiendas = false }: { onBack: () => void; soloMisTiendas?: boolean }) {
  const [sesion, setSesion] = useState<Sesion>(null);
  const [corte, setCorte] = useState<Corte | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [intento, setIntento] = useState(0);
  const pin = usePinDeSesion(() => setIntento((i) => i + 1));
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
    setError(null);
    cargarEstructura()
      .then((c) => activo && setCorte(c))
      .catch((e) => activo && setError(e ?? true));
    return () => {
      activo = false;
    };
  }, [intento]);

  // An AT only sees their own stores (and nothing if their name isn't found).
  // Others get an optional "Mis tiendas" when they are the AT of some stores.
  const yo = normalizarNombre(sesion?.nombre);
  const tengoTiendas = useMemo(() => !!yo && !!corte?.tiendas.some((t) => normalizarNombre(t.asesor) === yo), [corte, yo]);
  const resultado = useMemo(() => {
    if (soloMisTiendas && !yo) return [];
    const filtro = soloMisTiendas || (tengoTiendas && soloMias) ? sesion?.nombre : undefined;
    const base = buscarTiendas(corte?.tiendas || [], texto, filtro);
    return conVacantes ? base.filter((t) => t.vacantes > 0) : base;
  }, [corte, texto, tengoTiendas, soloMias, soloMisTiendas, yo, conVacantes, sesion?.nombre]);
  const sinTiendas = soloMisTiendas && !!corte && !tengoTiendas;
  const t = totales(resultado);
  // What the summary talks about: the AT's stores (or "Mis tiendas"), before search and filters.
  const misTiendas = soloMisTiendas || (tengoTiendas && soloMias);
  const alcance = useMemo(() => {
    if (soloMisTiendas && !yo) return [];
    return buscarTiendas(corte?.tiendas || [], '', misTiendas ? sesion?.nombre : undefined);
  }, [corte, soloMisTiendas, yo, misTiendas, sesion?.nombre]);
  const ta = totales(alcance);
  const conHuecos = alcance.filter((x) => x.vacantes > 0);
  const vacantesPorPuesto = useMemo(() => {
    const m = new Map<string, number>();
    alcance.forEach((x) => x.posiciones.forEach((p) => { if (!p.empleado) m.set(p.puesto, (m.get(p.puesto) || 0) + 1); }));
    return [...m].map(([etiqueta, valor]) => ({ etiqueta: titulo(etiqueta), valor })).sort((a, b) => b.valor - a.valor);
  }, [alcance]);
  const masAntigua = useMemo(() => {
    let max = -1;
    alcance.forEach((x) => x.posiciones.forEach((p) => { if (!p.empleado) { const d = diasVacante(p.vacanteDesde); if (d !== null && d > max) max = d; } }));
    return max;
  }, [alcance]);

  // Excel with every position of the stores in view (an AT: only theirs).
  const [descargando, setDescargando] = useState(false);
  const descargar = async () => {
    if (!corte || !resultado.length || descargando) return;
    setDescargando(true);
    try {
      const { bytes, nombre } = excelEstructura(resultado, corte.mes);
      await compartirArchivo(bytes, nombre, MIME.xlsx);
    } catch (e) {
      showAlert('No se pudo descargar', `No se pudo generar el Excel: ${e instanceof Error ? e.message : 'error desconocido'}.`);
    } finally {
      setDescargando(false);
    }
  };

  return (
    <View style={styles.screen}>
      <LinearGradient colors={gradients.fondo.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <Encabezado titulo="Estructura" eyebrow={`Plaza Oaxaca${actualizado ? ` · ${actualizado}` : ''}`} onBack={onBack} />

      {error ? (
        <View style={styles.content}>
          <View style={[styles.card, styles.aviso]}>
            <Icon name="alert" size={26} color={colors.oxRed} />
            {(() => {
              const a = pin.aviso(error, {
                titulo: 'No se pudo cargar la estructura',
                texto: 'Revisa tu conexión e intenta de nuevo.',
                accion: { texto: 'Reintentar', onPress: () => setIntento((i) => i + 1) },
              });
              return (
                <>
                  <Text style={styles.avisoTitulo}>{a.titulo}</Text>
                  <Text style={styles.avisoTexto}>{a.texto}</Text>
                  <Pressable accessibilityRole="button" style={styles.avisoBoton} onPress={a.accion.onPress}>
                    <Text style={styles.avisoBotonTexto}>{a.accion.texto}</Text>
                  </Pressable>
                </>
              );
            })()}
          </View>
        </View>
      ) : !corte ? (
        <View style={{ padding: 16 }}>
          <Esqueleto />
        </View>
      ) : sinTiendas ? (
        <View style={styles.content}>
          <View style={[styles.card, styles.aviso]}>
            <Icon name="pin" size={26} color={colors.oxRed} />
            <Text style={styles.avisoTitulo}>No encontramos tiendas a tu nombre</Text>
            <Text style={styles.avisoTexto}>Tus tiendas salen del catálogo de asesores de RH. Si te falta alguna, avisa a RH.</Text>
          </View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {tengoTiendas && !soloMisTiendas ? (
            <View style={styles.chips}>
              <Chip texto="Mis tiendas" activo={soloMias} onPress={() => setSoloMias(true)} />
              <Chip texto="Toda la plaza" activo={!soloMias} onPress={() => setSoloMias(false)} />
            </View>
          ) : null}

          <LinearGradient colors={gradients.oxGrad.colors} start={gradients.oxGrad.start} end={gradients.oxGrad.end} style={styles.hero}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroKicker}>
                Vacantes{misTiendas ? ' · tus tiendas' : ''} · {mesTexto(corte.mes)}
              </Text>
              <Text style={styles.heroNumero}>{num(ta.vacantes)}</Text>
              <Text style={styles.heroBody}>
                en {plural(conHuecos.length, 'tienda', 'tiendas')} de {num(ta.tiendas)}
              </Text>
            </View>
            {masAntigua >= 0 ? (
              <View style={styles.heroVacantes}>
                <Text style={styles.heroVacNum}>{masAntigua}</Text>
                <Text style={styles.heroVacTxt}>días la más antigua</Text>
              </View>
            ) : null}
          </LinearGradient>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Cobertura</Text>
            <View style={styles.anilloFila}>
              <Anillo
                segmentos={[
                  { valor: ta.ocupadas, color: colors.ok },
                  { valor: ta.vacantes, color: colors.oxRed },
                ]}
                centro={<Text style={styles.anilloNum}>{pct(ta.cobertura)}</Text>}
              />
              <View style={{ flex: 1 }}>
                <Leyenda
                  items={[
                    { etiqueta: 'Ocupadas', valor: num(ta.ocupadas), color: colors.ok },
                    { etiqueta: 'Vacantes', valor: num(ta.vacantes), color: colors.oxRed },
                  ]}
                />
                <Text style={styles.coberturaNota}>{plural(ta.total, 'posición', 'posiciones')} en total</Text>
              </View>
            </View>
          </View>

          {vacantesPorPuesto.length ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Vacantes por puesto</Text>
              <Barras filas={vacantesPorPuesto} formato={(v) => String(v)} />
            </View>
          ) : null}

          <Pressable style={[styles.descargar, descargando && { opacity: 0.6 }]} onPress={descargar} disabled={descargando || !resultado.length} accessibilityRole="button">
            <Icon name="doc" size={18} color={colors.oxRed} />
            <Text style={styles.descargarTexto}>
              {descargando ? 'Generando Excel…' : `Descargar Excel · ${plural(t.total, 'posición', 'posiciones')}`}
            </Text>
          </Pressable>

          {conHuecos.length ? (
            <Desplegable titulo="Tiendas con vacantes" icono="alert" inicial resumen={`${plural(conHuecos.length, 'tienda', 'tiendas')} · toca una para ver sus posiciones`}>
              {conHuecos.map((x, i) => (
                <Pressable accessibilityRole="button" key={x.cr || x.tienda} style={[styles.tiendaFila, i < conHuecos.length - 1 && styles.posLinea]} onPress={() => setDetalle(x)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tiendaNombre} numberOfLines={1}>
                      {x.tienda}
                    </Text>
                    <Text style={styles.tiendaMeta} numberOfLines={1}>
                      {x.cr} · {x.ocupadas} de {x.ocupadas + x.vacantes} ocupadas
                    </Text>
                  </View>
                  <View style={styles.vacPill}>
                    <Text style={styles.vacPillTxt}>{plural(x.vacantes, 'vacante', 'vacantes')}</Text>
                  </View>
                </Pressable>
              ))}
            </Desplegable>
          ) : null}

          <Desplegable titulo="Todas las tiendas" icono="pin" resumen={`${plural(alcance.length, 'tienda', 'tiendas')} · busca por tienda, CR o colaborador`}>
            <View style={styles.buscador}>
              <Icon name="search" size={18} color={colors.ink3} />
              <TextInput
                style={styles.buscadorInput}
                value={texto}
                onChangeText={setTexto}
                placeholder="Tienda, CR o colaborador"
                placeholderTextColor={colors.placeholder}
                autoCorrect={false}
                returnKeyType="search"
              />
            </View>
            <View style={styles.chips}>
              <Chip texto="Todas" activo={!conVacantes} onPress={() => setConVacantes(false)} />
              <Chip texto="Con vacantes" activo={conVacantes} onPress={() => setConVacantes(true)} />
            </View>
            {resultado.length ? (
              resultado.slice(0, MAX_LISTA).map((x, i, arr) => (
                <Pressable accessibilityRole="button" key={x.cr || x.tienda} style={[styles.tiendaFila, i < arr.length - 1 && styles.posLinea]} onPress={() => setDetalle(x)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tiendaNombre} numberOfLines={1}>
                      {x.tienda}
                    </Text>
                    <View style={styles.barra}>
                      <View style={[styles.barraLlena, { flex: x.ocupadas }]} />
                      <View style={{ flex: x.vacantes }} />
                    </View>
                  </View>
                  <Text style={[styles.tiendaCuenta, x.vacantes > 0 && { color: colors.oxRed }]}>
                    {x.ocupadas}/{x.ocupadas + x.vacantes}
                  </Text>
                </Pressable>
              ))
            ) : (
              <Text style={styles.nota}>Ninguna tienda coincide con la búsqueda.</Text>
            )}
            {resultado.length > MAX_LISTA ? <Text style={styles.nota}>Se muestran {MAX_LISTA}; usa la búsqueda para ver las demás.</Text> : null}
          </Desplegable>
        </ScrollView>
      )}

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
            <Pressable accessibilityRole="button" style={styles.headerButton} onPress={() => setDetalle(null)} accessibilityLabel="Cerrar">
              <Icon name="close" size={20} color={colors.ink} />
            </Pressable>
          </View>
          {detalle ? <DetalleTienda t={detalle} /> : null}
        </SafeAreaView>
      </Modal>
      {pin.modal}
    </View>
  );
}

function DetalleTienda({ t }: { t: TiendaEstructura }) {
  const vacantes = t.posiciones.filter((p) => !p.empleado);
  const ocupadas = t.posiciones.filter((p) => p.empleado);
  const total = t.posiciones.length;
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.anilloFila}>
          <Anillo
            segmentos={[
              { valor: t.ocupadas, color: colors.ok },
              { valor: t.vacantes, color: colors.oxRed },
            ]}
            tamano={96}
            grosor={12}
            centro={<Text style={styles.anilloNum}>{t.ocupadas}/{total}</Text>}
          />
          <View style={{ flex: 1 }}>
            <Leyenda
              items={[
                { etiqueta: 'Ocupadas', valor: num(t.ocupadas), color: colors.ok },
                { etiqueta: 'Vacantes', valor: num(t.vacantes), color: colors.oxRed },
              ]}
            />
          </View>
        </View>
      </View>
      {vacantes.length ? (
        <Desplegable titulo="Vacantes" icono="alert" inicial resumen={plural(vacantes.length, 'posición por cubrir', 'posiciones por cubrir')}>
          {vacantes.map((p, i) => {
            const d = diasVacante(p.vacanteDesde);
            return (
              <View key={p.id || i} style={[styles.pos, i < vacantes.length - 1 && styles.posLinea]}>
                <View style={[styles.punto, { backgroundColor: colors.oxRed }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.posPuesto}>{titulo(p.puesto)}</Text>
                  <Text style={styles.posMeta}>
                    Desde {fechaCorta(p.vacanteDesde)}
                    {d === 0 ? ' · hoy' : d !== null ? ` · ${plural(d, 'día', 'días')}` : ''}
                  </Text>
                </View>
              </View>
            );
          })}
        </Desplegable>
      ) : null}
      <Desplegable titulo="Ocupadas" icono="user" inicial={!vacantes.length} resumen={plural(ocupadas.length, 'colaborador', 'colaboradores')}>
        {ocupadas.length ? (
          ocupadas.map((p, i) => (
            <View key={p.id || i} style={[styles.pos, i < ocupadas.length - 1 && styles.posLinea]}>
              <View style={[styles.punto, { backgroundColor: colors.ok }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.posPuesto}>{p.empleado}</Text>
                <Text style={styles.posMeta}>{titulo(p.puesto)}</Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.nota}>Sin posiciones ocupadas.</Text>
        )}
      </Desplegable>
    </ScrollView>
  );
}


function Chip({ texto, activo, onPress }: { texto: string; activo: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" style={[styles.chip, activo && styles.chipActivo]} onPress={onPress} accessibilityState={{ selected: activo }}>
      <Text style={[styles.chipText, activo && styles.chipTextActivo]}>{texto}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  anilloFila: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  anilloNum: { fontFamily: fontFamily.extrabold, fontSize: 20, color: colors.ink },
  coberturaNota: { fontFamily: fontFamily.semibold, fontSize: 12, color: colors.ink3, marginTop: 10 },
  tiendaFila: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  tiendaCuenta: { fontFamily: fontFamily.extrabold, fontSize: 14, color: colors.ok, minWidth: 40, textAlign: 'right' },
  vacPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radii.pill, backgroundColor: '#FFF0EC' },
  vacPillTxt: { fontFamily: fontFamily.extrabold, fontSize: 12, color: colors.oxRed },
  screen: { flex: 1, backgroundColor: colors.bg },
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
  title: { fontFamily: fontFamily.extrabold, fontSize: 25, lineHeight: 29, color: colors.ink },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 12 },
  nota: { ...type.caption, color: colors.ink2 },
  hero: { borderRadius: 24, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 14, ...shadows.hero },
  heroKicker: { fontFamily: fontFamily.extrabold, fontSize: 12, color: 'rgba(255,255,255,.84)', textTransform: 'uppercase' },
  heroNumero: { fontFamily: fontFamily.extrabold, fontSize: 44, lineHeight: 52, color: colors.white, marginTop: 2 },
  heroBody: { fontFamily: fontFamily.semibold, fontSize: 13, lineHeight: 18, color: 'rgba(255,255,255,.9)' },
  heroVacantes: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,.2)', borderRadius: 18, paddingVertical: 12, paddingHorizontal: 14, minWidth: 86 },
  heroVacNum: { fontFamily: fontFamily.extrabold, fontSize: 28, color: colors.white },
  heroVacTxt: { fontFamily: fontFamily.bold, fontSize: 12, color: 'rgba(255,255,255,.9)' },
  card: {
    borderRadius: radii.xl,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    ...shadows.card,
  },
  cardTitle: { fontFamily: fontFamily.extrabold, fontSize: 16, color: colors.ink, marginBottom: 4 },
  aviso: { alignItems: 'center', gap: 8, paddingVertical: 28 },
  avisoTitulo: { fontFamily: fontFamily.extrabold, fontSize: 16, color: colors.ink, textAlign: 'center' },
  avisoTexto: { ...type.caption, color: colors.ink2, textAlign: 'center', maxWidth: 300 },
  avisoBoton: { marginTop: 6, paddingHorizontal: 18, paddingVertical: 10, borderRadius: radii.pill, backgroundColor: colors.oxRed },
  avisoBotonTexto: { fontFamily: fontFamily.bold, fontSize: 13.5, color: colors.white },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: radii.pill, backgroundColor: colors.field, borderWidth: 1, borderColor: colors.line },
  chipActivo: { backgroundColor: colors.oxRed, borderColor: colors.oxRed },
  chipText: { fontFamily: fontFamily.bold, fontSize: 13, color: colors.ink2 },
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
  buscadorInput: { flex: 1, fontFamily: fontFamily.semibold, fontSize: 15, color: colors.ink, paddingVertical: 12 },
  descargar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 46,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.oxRed,
    backgroundColor: colors.white,
  },
  descargarTexto: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.oxRed },
  tiendaNombre: { fontFamily: fontFamily.extrabold, fontSize: 14.5, color: colors.ink },
  tiendaMeta: { fontFamily: fontFamily.semibold, fontSize: 12, color: colors.ink2, marginTop: 2 },
  barra: { flexDirection: 'row', height: 6, borderRadius: 3, backgroundColor: '#FFE1DA', overflow: 'hidden', marginTop: 8 },
  barraLlena: { backgroundColor: colors.ok },
  pos: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  posLinea: { borderBottomWidth: 1, borderBottomColor: colors.line },
  punto: { width: 9, height: 9, borderRadius: 5 },
  posPuesto: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.ink },
  posMeta: { fontFamily: fontFamily.semibold, fontSize: 12, color: colors.ink2, marginTop: 2 },

});
