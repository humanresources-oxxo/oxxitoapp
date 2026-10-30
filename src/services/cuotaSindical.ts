// src/services/cuotaSindical.ts
// Cuota sindical from DashboardsOxxo's Cuota Sindical dashboard. Its data is not
// in the dashboards' public sheet: it lives in a private workbook of the Apps
// Script, and the public action "consultarCuotaSindical" only returns totals by
// month, división, store and puesto (no names: union membership is sensitive
// personal data). Plaza Oaxaca only (its divisiones are OXXO OAXACA I/II/III).
// If DashboardsOxxo changes that action or its columns, update this file too.
import { clave } from './gviz';
import { asesorDelCatalogo, cargarTiendas } from './tiendas';

// DashboardsOxxo js/config.js -> ADMIN_UPLOAD_URL (same Apps Script as Actas).
const URL =
  'https://script.google.com/macros/s/AKfycbwe_RcnVRkZy9x1YcRuum4qdLucIWLTVsnTZcMvQDyobo6f3ot-YG0Lv00hYS-1XEg/exec';

export const SIN_ASESOR = 'Sin Asesor Asignado';
export const ENTRENAMIENTO = 'Entrenamiento / Operaciones';
const TODAS = 'Todas';

// One row per month, división, store and puesto (Detalle sheet).
export type CuotaFila = {
  mes: string; // AAAA-MM
  division: string;
  tienda: string;
  funcion: string;
  asesor: string;
  importe: number; // net amount withheld
  personas: number;
  devoluciones: number;
  importeDevoluciones: number;
  reversos: number;
};
// One row per month and división, plus división "Todas" (Resumen sheet):
// exact people counts, which the Detalle can't give (a person in two stores
// counts twice there).
export type CuotaMes = {
  mes: string;
  division: string;
  personas: number;
  sinDescuento: number;
  semanas: number;
  importe: number;
};
export type Cuota = { detalle: CuotaFila[]; resumen: CuotaMes[]; meses: string[]; cargadoEl: string };

// Column order of CUOTA_DETALLE_HEADERS / CUOTA_RESUMEN_HEADERS in the Apps Script.
const num = (v: unknown) => Number(v) || 0;
const texto = (v: unknown) => String(v ?? '').trim();
// Sheets turns "2025-10" into a date: it comes back as "2025-10-01T06:00:00.000Z".
export function mesDe(v: unknown) {
  const m = texto(v).match(/^(\d{4})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}` : '';
}
// "Fri Oct 30 2026 11:42:00 GMT-0600 (...)" -> "30/oct/2026"
const MESES_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function fechaCarga(v: unknown) {
  const m = texto(v).match(/^\w{3} (\w{3}) (\d{1,2}) (\d{4})/);
  const i = m ? MESES_EN.indexOf(m[1]) : -1;
  return i >= 0 ? `${+m![2]}/${MESES[i]}/${m![3]}` : '';
}

const esEntrenamiento = (tienda: string) => /entrenamiento|operaciones/.test(clave(tienda));

let enMemoria: Promise<Cuota> | null = null;
export function cargarCuota(): Promise<Cuota> {
  enMemoria ??= (async () => {
    const control = new AbortController();
    const t = setTimeout(() => control.abort(), 30000);
    let datos: any;
    try {
      // text/plain avoids the CORS preflight Apps Script does not answer (web).
      const r = await fetch(URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'consultarCuotaSindical' }),
        signal: control.signal,
      });
      datos = await r.json();
    } finally {
      clearTimeout(t);
    }
    if (!datos || datos.ok === false) throw new Error((datos && datos.error) || 'el servidor no respondió');
    const catalogo = await cargarTiendas();
    const asesores = new Map<string, string>();
    const asesorDe = (tienda: string) => {
      if (!asesores.has(tienda)) {
        asesores.set(tienda, esEntrenamiento(tienda) ? ENTRENAMIENTO : asesorDelCatalogo(catalogo, { tienda }) || SIN_ASESOR);
      }
      return asesores.get(tienda)!;
    };
    const detalle: CuotaFila[] = (datos.detalle || [])
      .map((f: unknown[]) => ({
        mes: mesDe(f[0]),
        division: texto(f[1]),
        tienda: texto(f[2]),
        funcion: texto(f[3]),
        asesor: asesorDe(texto(f[2])),
        importe: num(f[4]),
        personas: num(f[5]),
        devoluciones: num(f[7]),
        importeDevoluciones: num(f[8]),
        reversos: num(f[9]),
      }))
      .filter((f: CuotaFila) => f.mes);
    const resumen: CuotaMes[] = (datos.resumen || [])
      .map((f: unknown[]) => ({
        mes: mesDe(f[0]),
        division: texto(f[1]),
        personas: num(f[2]),
        sinDescuento: num(f[3]),
        semanas: num(f[4]),
        importe: num(f[5]),
      }))
      .filter((f: CuotaMes) => f.mes && f.division === TODAS);
    const meses = [...new Set(detalle.map((f) => f.mes))].sort();
    return { detalle, resumen, meses, cargadoEl: fechaCarga(datos.carga?.fecha) };
  })().catch((e) => {
    enMemoria = null;
    throw e;
  });
  return enMemoria;
}

export const suma = <T>(lista: T[], key: keyof T) => lista.reduce((s, x) => s + (Number(x[key]) || 0), 0);

export type Grupo = { nombre: string; importe: number; personas: number; tiendas: number; ajustes: number };
export function agrupar(lista: CuotaFila[], key: 'asesor' | 'funcion' | 'tienda'): Grupo[] {
  const mapa = new Map<string, CuotaFila[]>();
  lista.forEach((f) => {
    const n = f[key] || 'Sin dato';
    if (!mapa.has(n)) mapa.set(n, []);
    mapa.get(n)!.push(f);
  });
  return [...mapa]
    .map(([nombre, items]) => ({
      nombre,
      importe: suma(items, 'importe'),
      personas: suma(items, 'personas'),
      tiendas: new Set(items.map((i) => i.tienda)).size,
      ajustes: suma(items, 'devoluciones') + suma(items, 'reversos'),
    }))
    .sort((a, b) => b.importe - a.importe);
}
