// src/services/dilos.ts
// Casos DILOS: open cases of the Zona Centro Sur, app only (not in any
// dashboard). RH uploads the "Reporte DILOS" from DashboardsOxxo's admin panel
// (Administrativo, with the panel's session; js/dilos-conoxxo.js there drops
// the facilitator's name) and its Apps Script keeps it in a private workbook
// (publicarDilos, v64). The app reads it with consultarDilos, which since v65
// needs the session key of a puesto with permissions (migration 41).
// If DashboardsOxxo changes that action or its fields, update this file too.
import { leerLlave, olvidarLlave, SIN_SESION } from './sesion';

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

// Escalation matrix of the Línea Ética (RH's "Seguimiento de folios" workbook,
// tab "Dashboard ZCS"): the level comes from the days open in the portal.
// If RH changes the matrix there, change it here too.
export type NivelDilos = 'tiempo' | 'n1' | 'n2' | 'n3';
export const MATRIZ_DILOS: Array<{
  nivel: NivelDilos;
  nombre: string;
  fase: string;
  desde: number;
  hasta: number | null; // null = no limit
  sesion: string;
  participantes: string[];
}> = [
  { nivel: 'tiempo', nombre: 'En tiempo', fase: 'Seguimiento normal', desde: 0, hasta: 19, sesion: '—', participantes: ['Facilitador'] },
  {
    nivel: 'n1',
    nombre: 'Nivel 1',
    fase: 'Preventiva',
    desde: 20,
    hasta: 25,
    sesion: 'Día 15',
    participantes: ['Coordinador Laboral', 'Facilitador', 'Gerente Regional RH', 'Gerente de Plaza'],
  },
  {
    nivel: 'n2',
    nombre: 'Nivel 2',
    fase: 'Alerta',
    desde: 26,
    hasta: 50,
    sesion: 'Días 20–25',
    participantes: ['Coordinador Laboral', 'Gerente Laboral', 'Facilitador', 'Gerente Regional RH', 'Encargado de Sistema Ético', 'Gerente Regional de Operaciones'],
  },
  {
    nivel: 'n3',
    nombre: 'Nivel 3',
    fase: 'Crítica',
    desde: 51,
    hasta: null,
    sesion: 'Días 45–55',
    participantes: [
      'Coordinador Laboral',
      'Gerente Laboral',
      'Director Laboral',
      'Gerente Ética',
      'Facilitador',
      'Gerente Regional de Operaciones',
      'Gerente Zonal de Operaciones',
      'Director de Zona',
    ],
  },
];
// From this day a case still "en tiempo" needs its Nivel 1 session scheduled.
export const DIA_AGENDAR_N1 = 15;

export function nivelDe(dias: number): NivelDilos {
  const fila = [...MATRIZ_DILOS].reverse().find((m) => dias >= m.desde);
  return fila ? fila.nivel : 'tiempo';
}
export const porAgendar = (c: CasoDilos) => nivelDe(c.dias) === 'tiempo' && c.dias >= DIA_AGENDAR_N1;
// What to do now, as in the workbook's "Sesión / acción" column.
export function accionDe(c: CasoDilos) {
  const n = nivelDe(c.dias);
  if (n === 'tiempo') return porAgendar(c) ? 'Agendar sesión Nivel 1' : 'Seguimiento normal';
  return `Sesión ${MATRIZ_DILOS.find((m) => m.nivel === n)!.sesion.toLowerCase()}`;
}
// Days until the next level (null in Nivel 3).
export function diasParaSiguiente(c: CasoDilos) {
  const fila = MATRIZ_DILOS.find((m) => m.nivel === nivelDe(c.dias))!;
  return fila.hasta === null ? null : fila.hasta + 1 - c.dias;
}

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
        // The session key: v65 of the Apps Script only answers puestos with permissions.
        body: JSON.stringify({ action: 'consultarDilos', llave: (await leerLlave()) ?? '' }),
        signal: control.signal,
      });
      datos = await r.json();
    } finally {
      clearTimeout(t);
    }
    if (!datos || datos.ok === false) {
      const motivo = String((datos && datos.error) || 'el servidor no respondió');
      if (motivo.includes(SIN_SESION)) await olvidarLlave();
      throw new Error(motivo);
    }
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
