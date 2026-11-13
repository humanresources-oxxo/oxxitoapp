// src/screens/EstructuraEquipo.tsx
// The "Equipo" view of Estructura: who is on the teams in view (the AT's
// stores, or the whole plaza), from the weekly Plantilla con Demográficos
// (services/plantilla.ts): gender, age, seniority, birthdays of the month and
// who is not working in the store right now. Gender and age are shown as
// totals, never next to a person's name.
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable } from '../components/Pressable';
import { Anillo, Barras, Desplegable, Indicador, Leyenda } from '../components/Visual';
import {
  Colaborador,
  Plantilla,
  RANGOS_ANTIGUEDAD,
  RANGOS_EDAD,
  resumenEquipo,
  textoAntiguedad,
  tiendasConEquipoNuevo,
} from '../services/plantilla';
import { colors, fontFamily, gradients, radii, shadows, type } from '../theme/tokens';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const num = (n: number) => n.toLocaleString('es-MX');
const pct = (x: number) => `${Math.round(x * 100)}%`;
const plural = (n: number, uno: string, varios: string) => `${num(n)} ${n === 1 ? uno : varios}`;
// "Ayudante Tienda" -> "Ayudantes", for the women-per-puesto rows.
const puestoPlural = (p: string) => (/^l[ií]der/i.test(p) ? 'Líderes' : /^encargad/i.test(p) ? 'Encargados' : /^ayudante/i.test(p) ? 'Ayudantes' : p);
// "S46" -> "semana 46"
const semanaTexto = (s: string) => {
  const m = s.match(/(\d{1,2})/);
  return m ? `semana ${+m[1]}` : '';
};

export function EquipoResumen({
  colaboradores,
  plantilla,
  misTiendas,
  onTienda,
}: {
  colaboradores: Colaborador[];
  plantilla: Plantilla;
  misTiendas: boolean;
  onTienda: (t: { cr: string; tienda: string }) => void;
}) {
  const hoy = useMemo(() => new Date(), []);
  const r = useMemo(() => resumenEquipo(colaboradores, hoy), [colaboradores, hoy]);
  const nuevas = useMemo(() => tiendasConEquipoNuevo(colaboradores, hoy), [colaboradores, hoy]);
  const conSexo = r.mujeres + r.hombres;
  const semana = semanaTexto(plantilla.semana);

  if (!r.total) {
    return (
      <View style={[styles.card, { alignItems: 'center', paddingVertical: 28 }]}>
        <Text style={styles.cardTitle}>Sin colaboradores en estas tiendas</Text>
        <Text style={styles.nota}>La plantilla de esta semana no trae a nadie en las tiendas que estás viendo.</Text>
      </View>
    );
  }

  return (
    <>
      <LinearGradient colors={gradients.blue.colors} start={gradients.blue.start} end={gradients.blue.end} style={styles.hero}>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroKicker}>
            Equipo{misTiendas ? ' · tus tiendas' : ''}
            {semana ? ` · ${semana}` : ''}
          </Text>
          <Text style={styles.heroNumero}>{num(r.total)}</Text>
          <Text style={styles.heroBody}>{r.total === 1 ? 'colaborador activo' : 'colaboradores activos'}</Text>
        </View>
        {r.nuevos ? (
          <View style={styles.heroCaja}>
            <Text style={styles.heroCajaNum}>{num(r.nuevos)}</Text>
            <Text style={styles.heroCajaTxt}>con menos de 3 meses</Text>
          </View>
        ) : null}
      </LinearGradient>

      {conSexo ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Género</Text>
          <View style={styles.anilloFila}>
            <Anillo
              segmentos={[
                { valor: r.mujeres, color: colors.oxRed },
                { valor: r.hombres, color: colors.oxBlue },
              ]}
              centro={<Text style={styles.anilloNum}>{pct(r.mujeres / conSexo)}</Text>}
            />
            <View style={{ flex: 1 }}>
              <Leyenda
                items={[
                  { etiqueta: 'Mujeres', valor: num(r.mujeres), color: colors.oxRed },
                  { etiqueta: 'Hombres', valor: num(r.hombres), color: colors.oxBlue },
                ]}
              />
              <Text style={styles.pie}>{pct(r.mujeres / conSexo)} del equipo son mujeres</Text>
            </View>
          </View>
          {r.porPuesto.length > 1 ? (
            <View style={styles.bloque}>
              <Text style={styles.subtitulo}>Mujeres por puesto</Text>
              <Barras
                filas={r.porPuesto.map((p) => ({
                  etiqueta: puestoPlural(p.puesto),
                  valor: p.total ? p.mujeres / p.total : 0,
                  detalle: `${num(p.mujeres)} de ${num(p.total)}`,
                }))}
                formato={pct}
              />
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.fila}>
        <Indicador valor={r.edadPromedio === null ? '—' : `${Math.round(r.edadPromedio)} años`} etiqueta="Edad promedio" />
        <Indicador valor={textoAntiguedad(r.antiguedadMediana === null ? null : Math.round(r.antiguedadMediana)) || '—'} etiqueta="Antigüedad típica (mediana)" />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Antigüedad</Text>
        <Barras filas={RANGOS_ANTIGUEDAD.map((etiqueta, i) => ({ etiqueta, valor: r.antiguedades[i] }))} formato={(v) => num(v)} destacar={RANGOS_ANTIGUEDAD[0]} />
        <Text style={styles.pie}>
          {r.nuevos ? `${pct(r.nuevos / r.total)} del equipo entró hace menos de 3 meses.` : 'Nadie entró en los últimos 3 meses.'}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Edad</Text>
        <Barras filas={RANGOS_EDAD.map((etiqueta, i) => ({ etiqueta, valor: r.edades[i] }))} formato={(v) => num(v)} />
      </View>

      {nuevas.length ? (
        <Desplegable titulo="Tiendas con equipo nuevo" icono="alert" resumen={`${plural(nuevas.length, 'tienda', 'tiendas')} con 40% o más del equipo con menos de 3 meses`}>
          {nuevas.slice(0, 30).map((t, i, arr) => (
            <Pressable accessibilityRole="button" key={t.cr || t.tienda} style={[styles.renglon, i < arr.length - 1 && styles.linea]} onPress={() => onTienda(t)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.renglonTitulo} numberOfLines={1}>
                  {t.tienda}
                </Text>
                <Text style={styles.renglonMeta}>
                  {t.nuevos} de {t.total} con menos de 3 meses
                </Text>
              </View>
              <View style={styles.pill}>
                <Text style={styles.pillTxt}>{pct(t.nuevos / t.total)}</Text>
              </View>
            </Pressable>
          ))}
        </Desplegable>
      ) : null}

      <Desplegable titulo={`Cumpleaños de ${MESES[hoy.getMonth()]}`} icono="gift" resumen={r.cumpleMes.length ? plural(r.cumpleMes.length, 'colaborador cumple este mes', 'colaboradores cumplen este mes') : 'Nadie cumple años este mes'}>
        {r.cumpleMes.length ? (
          r.cumpleMes.slice(0, 200).map((c, i, arr) => (
            <View key={c.numero} style={[styles.renglon, i < arr.length - 1 && styles.linea]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.renglonTitulo} numberOfLines={1}>
                  {c.nombre}
                </Text>
                <Text style={styles.renglonMeta} numberOfLines={1}>
                  {c.tienda}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.nota}>Sin cumpleaños este mes en estas tiendas.</Text>
        )}
      </Desplegable>

      {r.fueraDeTienda.length ? (
        <Desplegable titulo="Fuera de la operación de tienda" icono="user" resumen={`${plural(r.fueraDeTienda.reduce((s, x) => s + x.total, 0), 'colaborador', 'colaboradores')} · incapacidad, banca, contingencia…`}>
          <Barras filas={r.fueraDeTienda.map((x) => ({ etiqueta: x.situacion, valor: x.total }))} formato={(v) => num(v)} />
        </Desplegable>
      ) : null}
    </>
  );
}

// Card for a store's detail: team size, gender mix, average age and typical
// seniority (totals only).
export function EquipoDeTienda({ colaboradores }: { colaboradores: Colaborador[] }) {
  const r = useMemo(() => resumenEquipo(colaboradores), [colaboradores]);
  if (!r.total) return null;
  const conSexo = r.mujeres + r.hombres;
  const datos: Array<[string, string]> = [
    ['Mujeres / hombres', conSexo ? `${r.mujeres} / ${r.hombres}` : '—'],
    ['Edad promedio', r.edadPromedio === null ? '—' : `${Math.round(r.edadPromedio)} años`],
    ['Antigüedad típica', textoAntiguedad(r.antiguedadMediana === null ? null : Math.round(r.antiguedadMediana)) || '—'],
    ['Con menos de 3 meses', `${r.nuevos} de ${r.total}`],
  ];
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Equipo</Text>
      {datos.map(([etq, valor], i) => (
        <View key={etq} style={[styles.dato, i < datos.length - 1 && styles.linea]}>
          <Text style={styles.datoEtq}>{etq}</Text>
          <Text style={styles.datoValor}>{valor}</Text>
        </View>
      ))}
    </View>
  );
}


const styles = StyleSheet.create({
  // Blue hero: the shared hero shadow is red.
  hero: { borderRadius: 24, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 14, ...shadows.hero, shadowColor: 'rgba(0,90,174,1)', shadowOpacity: 0.4 },
  heroKicker: { fontFamily: fontFamily.extrabold, fontSize: 12, color: 'rgba(255,255,255,.84)', textTransform: 'uppercase' },
  heroNumero: { fontFamily: fontFamily.titulo, fontSize: 44, lineHeight: 52, color: colors.white, marginTop: 2 },
  heroBody: { fontFamily: fontFamily.semibold, fontSize: 13, lineHeight: 18, color: 'rgba(255,255,255,.9)' },
  heroCaja: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,.2)', borderRadius: 18, paddingVertical: 12, paddingHorizontal: 14, minWidth: 86, maxWidth: 110 },
  heroCajaNum: { fontFamily: fontFamily.titulo, fontSize: 28, color: colors.white },
  heroCajaTxt: { fontFamily: fontFamily.bold, fontSize: 12, color: 'rgba(255,255,255,.9)', textAlign: 'center' },
  card: { borderRadius: radii.xl, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, padding: 16, ...shadows.card },
  cardTitle: { fontFamily: fontFamily.extrabold, fontSize: 16, color: colors.ink, marginBottom: 8 },
  subtitulo: { fontFamily: fontFamily.bold, fontSize: 13, color: colors.ink2, marginBottom: 10 },
  bloque: { marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.line },
  anilloFila: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  anilloNum: { fontFamily: fontFamily.titulo, fontSize: 20, color: colors.ink },
  pie: { fontFamily: fontFamily.semibold, fontSize: 12, color: colors.ink3, marginTop: 10 },
  fila: { flexDirection: 'row', gap: 12 },
  nota: { ...type.caption, color: colors.ink2, textAlign: 'center' },
  renglon: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  linea: { borderBottomWidth: 1, borderBottomColor: colors.line },
  renglonTitulo: { fontFamily: fontFamily.extrabold, fontSize: 14.5, color: colors.ink },
  renglonMeta: { fontFamily: fontFamily.semibold, fontSize: 12, color: colors.ink2, marginTop: 2 },
  pill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radii.pill, backgroundColor: '#FFF0EC' },
  pillTxt: { fontFamily: fontFamily.extrabold, fontSize: 12, color: colors.oxRed },
  dato: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 9 },
  datoEtq: { fontFamily: fontFamily.semibold, fontSize: 13.5, color: colors.ink2 },
  datoValor: { fontFamily: fontFamily.extrabold, fontSize: 14, color: colors.ink },
});
