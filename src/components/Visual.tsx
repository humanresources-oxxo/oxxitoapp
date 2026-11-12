// src/components/Visual.tsx
// Small visual building blocks for the data screens (Cuota sindical,
// Contratos colectivos, Casos DILOS): a card that expands, a ring chart, a
// tappable column chart, a stacked bar with legend and a delta pill. No chart
// library: Views and react-native-svg, same on iOS, Android and web.
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Pressable } from './Pressable';
import Svg, { Circle } from 'react-native-svg';
import { Icon } from './Icon';
import { colors, radii, shadows, fontFamily } from '../theme/tokens';

// Card with a header that opens and closes the detail. The summary line says
// what is inside, so the screen can stay short while closed.
export function Desplegable({
  titulo,
  resumen,
  icono,
  inicial = false,
  derecha,
  children,
}: {
  titulo: string;
  resumen?: string;
  icono?: string;
  inicial?: boolean;
  derecha?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [abierto, setAbierto] = useState(inicial);
  return (
    <View style={styles.card}>
      <Pressable
        style={styles.desHead}
        onPress={() => setAbierto((x) => !x)}
        accessibilityRole="button"
        accessibilityState={{ expanded: abierto }}
        accessibilityLabel={titulo}
      >
        {icono ? (
          <View style={styles.desIcono}>
            <Icon name={icono} size={18} color={colors.oxRed} />
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={styles.desTitulo}>{titulo}</Text>
          {resumen ? (
            <Text style={styles.desResumen} numberOfLines={abierto ? 3 : 1}>
              {resumen}
            </Text>
          ) : null}
        </View>
        {derecha}
        <View style={{ transform: [{ rotate: abierto ? '90deg' : '0deg' }] }}>
          <Icon name="chevR" size={18} color={colors.ink3} />
        </View>
      </Pressable>
      {abierto ? <View style={styles.desCuerpo}>{children}</View> : null}
    </View>
  );
}

// Ring chart: segments in order, starting at 12 o'clock. The centre shows
// whatever is passed (a number, a percentage...).
export function Anillo({
  segmentos,
  tamano = 112,
  grosor = 14,
  centro,
  pie,
}: {
  segmentos: Array<{ valor: number; color: string }>;
  tamano?: number;
  grosor?: number;
  centro?: React.ReactNode;
  pie?: string;
}) {
  const r = (tamano - grosor) / 2;
  const c = 2 * Math.PI * r;
  const total = segmentos.reduce((s, x) => s + Math.max(0, x.valor), 0);
  let acumulado = 0;
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: tamano, height: tamano }}>
        <Svg width={tamano} height={tamano} style={{ transform: [{ rotate: '-90deg' }] }}>
          <Circle cx={tamano / 2} cy={tamano / 2} r={r} stroke={colors.field} strokeWidth={grosor} fill="none" />
          {total > 0
            ? segmentos.map((s, i) => {
                const largo = (Math.max(0, s.valor) / total) * c;
                const el = (
                  <Circle
                    key={i}
                    cx={tamano / 2}
                    cy={tamano / 2}
                    r={r}
                    stroke={s.color}
                    strokeWidth={grosor}
                    fill="none"
                    strokeDasharray={`${largo} ${c - largo}`}
                    strokeDashoffset={-acumulado}
                  />
                );
                acumulado += largo;
                return el;
              })
            : null}
        </Svg>
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>{centro}</View>
      </View>
      {pie ? <Text style={styles.anilloPie}>{pie}</Text> : null}
    </View>
  );
}

// Legend rows for a ring or a stacked bar.
export function Leyenda({ items }: { items: Array<{ etiqueta: string; valor: string; color: string }> }) {
  return (
    <View style={{ gap: 8 }}>
      {items.map((x) => (
        <View key={x.etiqueta} style={styles.leyFila}>
          <View style={[styles.leyPunto, { backgroundColor: x.color }]} />
          <Text style={styles.leyEtq} numberOfLines={1}>
            {x.etiqueta}
          </Text>
          <Text style={styles.leyValor}>{x.valor}</Text>
        </View>
      ))}
    </View>
  );
}

// Vertical columns (e.g. months). Tapping one selects it.
export function Columnas({
  datos,
  seleccion,
  onSelect,
  alto = 120,
  formato,
}: {
  datos: Array<{ clave: string; etiqueta: string; valor: number }>;
  seleccion?: string;
  onSelect?: (clave: string) => void;
  alto?: number;
  formato?: (v: number) => string;
}) {
  const max = Math.max(0, ...datos.map((d) => d.valor)) || 1;
  const elegido = datos.find((d) => d.clave === seleccion);
  return (
    <View>
      {elegido && formato ? <Text style={styles.colValor}>{formato(elegido.valor)}</Text> : null}
      <View style={[styles.colFila, { height: alto }]}>
        {datos.map((d) => {
          const activo = d.clave === seleccion;
          return (
            <Pressable
              key={d.clave}
              style={styles.colToque}
              onPress={() => onSelect?.(d.clave)}
              accessibilityRole="button"
              accessibilityState={{ selected: activo }}
              accessibilityLabel={`${d.etiqueta}${formato ? ': ' + formato(d.valor) : ''}`}
            >
              <View style={[styles.col, { height: `${Math.max(4, (d.valor / max) * 100)}%` }, activo && styles.colActiva]} />
            </Pressable>
          );
        })}
      </View>
      <View style={styles.colEtqs}>
        {datos.map((d) => (
          <Text key={d.clave} style={[styles.colEtq, d.clave === seleccion && styles.colEtqActiva]} numberOfLines={1}>
            {d.etiqueta}
          </Text>
        ))}
      </View>
    </View>
  );
}

// Stacked columns (e.g. negotiations per month split by business unit).
export function ColumnasApiladas({
  datos,
  alto = 130,
}: {
  datos: Array<{ clave: string; etiqueta: string; segmentos: Array<{ valor: number; color: string }> }>;
  alto?: number;
}) {
  const total = (d: (typeof datos)[number]) => d.segmentos.reduce((x, s) => x + s.valor, 0);
  const max = Math.max(0, ...datos.map(total)) || 1;
  return (
    <View>
      <View style={[styles.colFila, { height: alto }]}>
        {datos.map((d) => (
          <View key={d.clave} style={styles.colToque} accessibilityLabel={`${d.etiqueta}: ${total(d)}`}>
            {total(d) ? <Text style={styles.colTotal}>{total(d)}</Text> : null}
            <View style={[styles.colPila, { height: `${(total(d) / max) * 82}%` }]}>
              {[...d.segmentos].reverse().map((s, i) => (s.valor ? <View key={i} style={{ flex: s.valor, backgroundColor: s.color }} /> : null))}
            </View>
          </View>
        ))}
      </View>
      <View style={styles.colEtqs}>
        {datos.map((d) => (
          <Text key={d.clave} style={styles.colEtq} numberOfLines={1}>
            {d.etiqueta}
          </Text>
        ))}
      </View>
    </View>
  );
}

// Big number tile ("129 mil · Colaboradores"); tono tints the value.
export function Indicador({ valor, etiqueta, tono }: { valor: string; etiqueta: string; tono?: string }) {
  return (
    <View style={[styles.card, styles.indicador]}>
      <Text style={[styles.indValor, tono ? { color: tono } : null]} numberOfLines={1} adjustsFontSizeToFit>
        {valor}
      </Text>
      <Text style={styles.indEtq} numberOfLines={2}>
        {etiqueta}
      </Text>
    </View>
  );
}

// One bar split in segments, with its legend below.
export function BarraApilada({ segmentos }: { segmentos: Array<{ etiqueta: string; valor: number; color: string; texto?: string }> }) {
  const total = segmentos.reduce((s, x) => s + x.valor, 0) || 1;
  return (
    <View style={{ gap: 12 }}>
      <View style={styles.apilada}>
        {segmentos
          .filter((s) => s.valor > 0)
          .map((s) => (
            <View key={s.etiqueta} style={{ flex: s.valor / total, backgroundColor: s.color }} />
          ))}
      </View>
      <Leyenda items={segmentos.map((s) => ({ etiqueta: s.etiqueta, valor: s.texto ?? String(s.valor), color: s.color }))} />
    </View>
  );
}

// "▲ 3.2%" in green or "▼ 18%" in red, on a light pill (for a dark hero).
export function Delta({ valor, texto }: { valor: number; texto: string }) {
  const sube = valor >= 0;
  return (
    <View style={styles.delta}>
      <Text style={styles.deltaTexto}>
        {sube ? '▲' : '▼'} {texto}
      </Text>
    </View>
  );
}

// Horizontal bar rows: label, bar and value.
export function Barras({
  filas,
  formato,
  maxFilas,
  destacar,
}: {
  filas: Array<{ etiqueta: string; valor: number; detalle?: string }>;
  formato: (v: number) => string;
  maxFilas?: number;
  destacar?: string;
}) {
  const [todas, setTodas] = useState(false);
  // Largest value (not at least 1: percentages come as fractions like 0.047).
  const max = Math.max(0, ...filas.map((f) => f.valor)) || 1;
  const visibles = maxFilas && !todas ? filas.slice(0, maxFilas) : filas;
  return (
    <View style={{ gap: 10 }}>
      {visibles.map((f) => (
        <View key={f.etiqueta} style={{ gap: 5 }}>
          <View style={styles.barTop}>
            <Text style={[styles.barEtq, f.etiqueta === destacar && { color: colors.oxRed }]} numberOfLines={1}>
              {f.etiqueta}
            </Text>
            <Text style={styles.barValor}>{formato(f.valor)}</Text>
          </View>
          <View style={styles.barFondo}>
            <View style={[styles.barLlena, f.etiqueta === destacar && { backgroundColor: colors.oxRed }, { width: `${Math.max(3, (f.valor / max) * 100)}%` }]} />
          </View>
          {f.detalle ? <Text style={styles.barDetalle}>{f.detalle}</Text> : null}
        </View>
      ))}
      {maxFilas && filas.length > maxFilas ? (
        <Pressable onPress={() => setTodas((x) => !x)} style={styles.verMas} accessibilityRole="button">
          <Text style={styles.verMasTexto}>{todas ? 'Ver menos' : `Ver las ${filas.length}`}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xl,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadows.card,
  },
  desHead: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  desIcono: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#FFF0EC', alignItems: 'center', justifyContent: 'center' },
  desTitulo: { fontFamily: fontFamily.extrabold, fontSize: 15.5, color: colors.ink },
  desResumen: { fontFamily: fontFamily.semibold, fontSize: 12.5, color: colors.ink2, marginTop: 2 },
  desCuerpo: { paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
  anilloPie: { fontFamily: fontFamily.bold, fontSize: 12, color: colors.ink2, marginTop: 8, textAlign: 'center' },
  leyFila: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  leyPunto: { width: 10, height: 10, borderRadius: 5 },
  leyEtq: { flex: 1, fontFamily: fontFamily.semibold, fontSize: 13, color: colors.ink2 },
  leyValor: { fontFamily: fontFamily.extrabold, fontSize: 13, color: colors.ink },
  colValor: { fontFamily: fontFamily.extrabold, fontSize: 13, color: colors.oxRed, textAlign: 'right', marginBottom: 6 },
  colFila: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  colToque: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  col: { borderTopLeftRadius: 6, borderTopRightRadius: 6, backgroundColor: '#F6C4BE' },
  colActiva: { backgroundColor: colors.oxRed },
  colEtqs: { flexDirection: 'row', gap: 4, marginTop: 6 },
  colEtq: { flex: 1, textAlign: 'center', fontFamily: fontFamily.bold, fontSize: 9.5, color: colors.ink3 },
  colEtqActiva: { color: colors.oxRed },
  colTotal: { fontFamily: fontFamily.extrabold, fontSize: 10, color: colors.ink2, textAlign: 'center', marginBottom: 3 },
  colPila: { borderTopLeftRadius: 5, borderTopRightRadius: 5, overflow: 'hidden', minHeight: 3 },
  indicador: { flex: 1, paddingVertical: 14, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', minHeight: 84 },
  indValor: { fontFamily: fontFamily.extrabold, fontSize: 24, color: colors.ink },
  indEtq: { fontFamily: fontFamily.bold, fontSize: 11.5, color: colors.ink2, textAlign: 'center', marginTop: 4 },
  apilada: { flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', backgroundColor: colors.field },
  delta: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.pill, backgroundColor: 'rgba(255,255,255,.22)', marginTop: 8 },
  deltaTexto: { fontFamily: fontFamily.extrabold, fontSize: 12.5, color: colors.white },
  barTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  barEtq: { flex: 1, fontFamily: fontFamily.bold, fontSize: 13, color: colors.ink },
  barValor: { fontFamily: fontFamily.extrabold, fontSize: 13, color: colors.ink },
  barFondo: { height: 8, borderRadius: 4, backgroundColor: colors.field, overflow: 'hidden' },
  barLlena: { height: 8, borderRadius: 4, backgroundColor: '#F3A39C' },
  barDetalle: { fontFamily: fontFamily.semibold, fontSize: 11.5, color: colors.ink3 },
  verMas: { alignSelf: 'flex-start', paddingVertical: 6 },
  verMasTexto: { fontFamily: fontFamily.extrabold, fontSize: 13, color: colors.oxRed },

});
