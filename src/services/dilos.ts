// src/services/dilos.ts
// Casos DILOS: open cases of the Zona Centro Sur, app only (not in any
// dashboard). RH uploads the "Reporte DILOS" from DashboardsOxxo's admin panel
// (Administrativo, with the panel's session; js/dilos-conoxxo.js there drops
// the facilitator's name) and its Apps Script keeps it in a private workbook
// (publicarDilos, v64). The app reads it with the public action consultarDilos.
// If DashboardsOxxo changes that action or its fields, update this file too.

// DashboardsOxxo js/config.js -> ADMIN_UPLOAD_URL (same Apps Script as Actas, Cuota and CCT).
const URL =
  'https://script.google.com/macros/s/AKfycbwe_RcnVRkZy9x1YcRuum4qdLucIWLTVsnTZcMvQDyobo6f3ot-YG0Lv00hYS-1XEg/exec';

export type CasoDilos = {
  caso: string;
  region: string;
  plaza: string;
  estatus: string; // "En atención RH" / "En atención ADM"
  area: 'RH' | 'ADM' | 'Otra';
  dias: number; // days open at the cut
};
export type Dilos = { casos: CasoDilos[]; corte: string; cargadoEl: string };

// Days open from which a case counts as delayed.
export const DIAS_ALERTA = 15;

let enMemoria: Promise<Dilos> | null = null;
export function cargarDilos(): Promise<Dilos> {
  enMemoria ??= (async () => {
    const control = new AbortController();
    const t = setTimeout(() => control.abort(), 30000);
    let datos: any;
    try {
      // text/plain avoids the CORS preflight Apps Script does not answer (web).
      const r = await fetch(URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'consultarDilos' }),
        signal: control.signal,
      });
      datos = await r.json();
    } finally {
      clearTimeout(t);
    }
    if (!datos || datos.ok === false) throw new Error((datos && datos.error) || 'el servidor no respondió');
    const casos: CasoDilos[] = (datos.casos ?? [])
      .map((c: any) => ({
        caso: String(c.caso ?? ''),
        region: String(c.region ?? ''),
        plaza: String(c.plaza ?? ''),
        estatus: String(c.estatus ?? ''),
        area: c.area === 'RH' || c.area === 'ADM' ? c.area : 'Otra',
        dias: Number(c.dias) || 0,
      }))
      .sort((a: CasoDilos, b: CasoDilos) => b.dias - a.dias);
    return { casos, corte: String(datos.carga?.corte ?? ''), cargadoEl: String(datos.carga?.fecha ?? '') };
  })().catch((e) => {
    enMemoria = null;
    throw e;
  });
  return enMemoria;
}

export function contarPor(casos: CasoDilos[], key: 'region' | 'plaza') {
  const m = new Map<string, number>();
  casos.forEach((c) => m.set(c[key] || 'Sin dato', (m.get(c[key] || 'Sin dato') || 0) + 1));
  return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'));
}
