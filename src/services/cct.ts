// src/services/cct.ts
// Contratos colectivos (CCT): app-only data, not in any dashboard. RH uploads
// the CCT Excel from DashboardsOxxo's admin panel (Administrativo, with the
// panel's own session; js/cct-conoxxo.js there normalizes it) and its Apps
// Script keeps it in a private workbook (publicarCct, v63). The app reads it
// with the public action consultarCct. It covers every OXXO plaza in the
// country: the screen shows Plaza Oaxaca's contract and how it compares with
// the rest. Indicators only: no names of responsables or links.
// If DashboardsOxxo changes that action or the row keys, update this file too.
import { clave } from './gviz';

// DashboardsOxxo js/config.js -> ADMIN_UPLOAD_URL (same Apps Script as Actas and Cuota sindical).
const URL =
  'https://script.google.com/macros/s/AKfycbwe_RcnVRkZy9x1YcRuum4qdLucIWLTVsnTZcMvQDyobo6f3ot-YG0Lv00hYS-1XEg/exec';

export type CctDatos = {
  anio?: number;
  cluster?: string;
  base?: string;
  plaza?: string;
  entidad?: string;
  localidad?: string;
  hc?: number;
  cts?: number;
  zona?: string;
  sindicato?: string;
  expediente?: string;
  vencimiento?: string; // AAAA-MM-DD
  tipoRevision?: string;
  estatusRevision?: string;
  fechaRevision?: string;
  diasRevision?: number; // revision date minus expiry date (negative = before)
  pctSalarioNominal?: number; // fraction (0.047 = 4.7%)
  pctSalario?: number;
  pctPrestaciones?: number;
  estatusConsulta?: string;
  fechaConsulta?: string;
  diasConsulta?: number;
  formaCreacion?: string;
  antiguedad?: number;
  anioLegitimacion?: number;
  participacionLeg?: number;
  aprobacionLeg?: number;
  participacion?: number;
  aprobacion?: number;
  docConstancia?: string;
  docCct?: string;
  docResolucionIntegral?: string;
  docResolucionSalarial?: string;
  docConvenioSalarial?: string;
  nivelCompliance?: number;
  pctCompliance?: number;
  fondoAhorro?: string;
  valesMin?: number;
  valesMax?: number;
  aguinaldoDias?: number;
  primaVacacional?: number;
  primaDominical?: number;
  salarioBase?: number;
  salarioPromedio?: number;
};
export type Cct = {
  historico: CctDatos[]; // sheet "CCTs Tiendas": one row per plaza and year
  ejercicio: CctDatos[]; // sheet "CCT ejercicio <año>": current year
  cargadoEl: string;
  archivo: string;
};

export const esOaxaca = (d: CctDatos) => clave(`${d.plaza} ${d.entidad}`).includes('oaxaca');
// The raise of the year: the ejercicio sheet calls it "% Salario nominal"; the
// historical one, "% Salario".
export const aumento = (d: CctDatos, hoja: 'historico' | 'ejercicio') => (hoja === 'ejercicio' ? d.pctSalarioNominal : d.pctSalario);

let enMemoria: Promise<Cct> | null = null;
export function cargarCct(): Promise<Cct> {
  enMemoria ??= (async () => {
    const control = new AbortController();
    const t = setTimeout(() => control.abort(), 30000);
    let datos: any;
    try {
      // text/plain avoids the CORS preflight Apps Script does not answer (web).
      const r = await fetch(URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'consultarCct' }),
        signal: control.signal,
      });
      datos = await r.json();
    } finally {
      clearTimeout(t);
    }
    if (!datos || datos.ok === false) throw new Error((datos && datos.error) || 'el servidor no respondió');
    const filas = (datos.filas ?? []) as Array<{ hoja: string; datos: CctDatos }>;
    return {
      historico: filas.filter((f) => f.hoja === 'historico').map((f) => f.datos),
      ejercicio: filas.filter((f) => f.hoja === 'ejercicio').map((f) => f.datos),
      // "AAAA-MM-DD HH:mm"
      cargadoEl: String(datos.carga?.fecha ?? ''),
      archivo: String(datos.carga?.archivo ?? ''),
    };
  })().catch((e) => {
    enMemoria = null;
    throw e;
  });
  return enMemoria;
}

export function promedio(valores: Array<number | undefined>) {
  const v = valores.filter((x): x is number => typeof x === 'number');
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
}
