// src/services/gviz.ts
// Reads tabs of DashboardsOxxo's Google Sheet through GViz CSV, the same way
// the dashboards do (js/core.js buildSheetURL). Shared by the screens that show
// dashboard data (Vacaciones, Estructura).

export const SPREADSHEET_ID = '1EbUuyy-PRXiDwPmn9L14P93cGN6VXTyLfAHx-CE8M_A';

export const sinAcentos = (v: unknown) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
// Header/value key: no accents, case, spaces or the "_buffer_" prefix GViz
// adds when it merges the buffer row into the header.
export const clave = (v: unknown) => sinAcentos(v).toLowerCase().replace(/^_buffer_\s*/, '').replace(/[^a-z0-9]/g, '');
export const normalizarNombre = (v: unknown) =>
  sinAcentos(v).toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();
export const letra = (i: number) => String.fromCharCode(65 + i);

// The sheets cover the five plazas of Region TABASCO, but the app only shows
// Plaza Oaxaca. Sheets sometimes write it as "OXXO OAXACA".
export const PLAZA = 'Oaxaca';
export const esPlaza = (v?: string) => clave(String(v ?? '').replace(/^\s*oxxo\s+/i, '')) === clave(PLAZA);

export function parsearCsv(texto: string): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [], celda = '', comillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (comillas) {
      if (c === '"' && texto[i + 1] === '"') { celda += '"'; i++; }
      else if (c === '"') comillas = false;
      else celda += c;
    } else if (c === '"') comillas = true;
    else if (c === ',') { fila.push(celda); celda = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      fila.push(celda); filas.push(fila); fila = []; celda = '';
    } else celda += c;
  }
  if (celda || fila.length) { fila.push(celda); filas.push(fila); }
  return filas;
}

export async function leerCsv(hoja: string, consulta?: string) {
  const params = [`tqx=out:csv`, `sheet=${encodeURIComponent(hoja)}`];
  // Published tabs have a _buffer_ row above the real headers; with a query
  // GViz must be told about both or it takes the first result as a header.
  if (consulta) params.push('headers=2', `tq=${encodeURIComponent(consulta)}`);
  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?${params.join('&')}`;
  const control = new AbortController();
  const t = setTimeout(() => control.abort(), 15000);
  try {
    const r = await fetch(url, { signal: control.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return parsearCsv(await r.text());
  } finally {
    clearTimeout(t);
  }
}

// Configuracion tab: one row per dashboard (dashboard_id, nombre, frecuencia,
// ultima_actualizacion, ...). Returns the upload date of `id`, or '' if unknown.
let configuracion: Promise<string[][]> | null = null;
export async function fechaConfiguracion(id: string): Promise<string> {
  configuracion ??= leerCsv('Configuracion').catch(() => {
    configuracion = null;
    return [];
  });
  const fila = (await configuracion).find((r) => String(r[0] ?? '').trim() === id);
  return String(fila?.[3] ?? '').trim();
}
