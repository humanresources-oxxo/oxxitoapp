// src/services/vacaciones.ts
// Vacation balances from DashboardsOxxo's Dashboard 5 (tab Dashboard_5_Semanal
// of the dashboards' Google Sheet, read through GViz CSV like the web does).
// Each employee looks up their own row by employee number; some puestos (the
// same as Actas, see services/actas.ts) can also look up their team.
// The sheet only has store staff (SINDICALIZADO): office staff won't be found.
// If DashboardsOxxo renames the tab or its columns, update this file too.
import { getJson, setJson, storageKeys } from './appStorage';

const SPREADSHEET_ID = '1EbUuyy-PRXiDwPmn9L14P93cGN6VXTyLfAHx-CE8M_A';
const TAB = 'Dashboard_5_Semanal';
const CONFIG_TAB = 'Configuracion';
const CONFIG_ID = 's5';
// Columns used in GViz queries (same letters as DashboardsOxxo js/config.js):
// the reply is checked against the header and falls back to the full tab.
const COL_NUMERO = 'H';
const COL_PLAZA = 'B';

export type Vacacion = {
  numEmpleado: string;
  nombre: string;
  plaza: string;
  asesor: string;
  tienda: string;
  puesto: string;
  fechaInicio: string; // AAAA-MM-DD, current anniversary period
  fechaFin: string;
  periodoAnterior: number;
  periodoActual: number;
  diasRestantes: number;
  venceAnterior: string; // Bucket_Ant, e.g. "0 a 50 días", "Ya vencieron sus días", "N/A"
  venceActual: string; // Bucket_Act, e.g. "Más de 9 MESES"
};

const sinAcentos = (v: unknown) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const clave = (v: unknown) => sinAcentos(v).toLowerCase().replace(/^_buffer_\s*/, '').replace(/[^a-z0-9]/g, '');
export const normalizarNombre = (v: unknown) =>
  sinAcentos(v).toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();

function parsearCsv(texto: string): string[][] {
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

async function leerCsv(hoja: string, consulta?: string) {
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

// Same aliases as findKey in js/dashboard-5-vacaciones.js.
const ALIAS: Record<keyof Vacacion, string[]> = {
  plaza: ['Plaza'],
  asesor: ['Asesor'],
  tienda: ['Tienda'],
  puesto: ['Puesto'],
  numEmpleado: ['No. De Empleado', 'No De Empleado', 'Numero de Empleado'],
  nombre: ['Nombre'],
  fechaInicio: ['Fecha_Inicio'],
  fechaFin: ['Fecha_Fin'],
  periodoAnterior: ['Periodo_Anterior'],
  periodoActual: ['Periodo_Actual'],
  diasRestantes: ['Dias_Restantes'],
  venceAnterior: ['Bucket_Ant'],
  venceActual: ['Bucket_Act'],
};
const NUMEROS: Array<keyof Vacacion> = ['periodoAnterior', 'periodoActual', 'diasRestantes'];
const letra = (i: number) => String.fromCharCode(65 + i);

function columnas(encabezado: string[]) {
  const claves = encabezado.map(clave);
  const idx = {} as Record<keyof Vacacion, number>;
  (Object.keys(ALIAS) as Array<keyof Vacacion>).forEach((k) => {
    idx[k] = claves.findIndex((h) => ALIAS[k].some((a) => clave(a) === h));
  });
  return idx;
}

function aVacaciones(filas: string[][]): { lista: Vacacion[]; idx: Record<keyof Vacacion, number> } {
  // Without a query GViz may return the _buffer_ row on its own.
  const datos = filas.length && filas[0].every((c) => clave(c) === '' || /^_buffer_$/i.test(c.trim())) ? filas.slice(1) : filas;
  const idx = columnas(datos[0] || []);
  const lista = datos
    .slice(1)
    .map((r) => {
      const v = {} as Record<keyof Vacacion, string | number>;
      (Object.keys(idx) as Array<keyof Vacacion>).forEach((k) => {
        const crudo = idx[k] >= 0 ? String(r[idx[k]] ?? '').trim() : '';
        v[k] = NUMEROS.includes(k) ? Number(crudo) || 0 : crudo;
      });
      return v as unknown as Vacacion;
    })
    .filter((v) => v.numEmpleado);
  return { lista, idx };
}

let tabCompleta: Promise<Vacacion[]> | null = null;
function leerTodo() {
  tabCompleta ??= leerCsv(TAB)
    .then((f) => aVacaciones(f).lista)
    .catch((e) => {
      tabCompleta = null;
      throw e;
    });
  return tabCompleta;
}

// Asks GViz for just the needed rows; if the column letter no longer matches
// the header (the tab changed), reads the whole tab and filters it here.
async function leerFiltrado(col: string, campo: keyof Vacacion, consulta: string, coincide: (v: Vacacion) => boolean) {
  const { lista, idx } = aVacaciones(await leerCsv(TAB, consulta));
  return (letra(idx[campo]) === col ? lista : await leerTodo()).filter(coincide);
}

const sinCeros = (v: unknown) => String(v ?? '').replace(/\D/g, '').replace(/^0+/, '');

export type MiVacacion = { vacacion: Vacacion | null; guardada?: boolean };

// Own balance. The last one read is kept on the phone (removed on logout)
// so it still shows without network.
export async function cargarMiVacacion(numeroEmpleado: string): Promise<MiVacacion> {
  const numero = sinCeros(numeroEmpleado);
  if (!numero) return { vacacion: null };
  try {
    const lista = await leerFiltrado(COL_NUMERO, 'numEmpleado', `select * where ${COL_NUMERO} = ${numero}`, (v) => sinCeros(v.numEmpleado) === numero);
    const vacacion = lista[0] || null;
    setJson(storageKeys.vacationBalance, vacacion ? { numero, vacacion } : null);
    return { vacacion };
  } catch (e) {
    const guardada = await getJson<{ numero: string; vacacion: Vacacion } | null>(storageKeys.vacationBalance, null);
    if (guardada?.numero === numero) return { vacacion: guardada.vacacion, guardada: true };
    throw e;
  }
}

export const PLAZAS = ['Oaxaca', 'Villahermosa', 'Chontalpa', 'Costa Istmo', 'Tuxtla'];

// Team view: one plaza at a time (~1,000 rows) so it stays light on the phone.
const porPlaza = new Map<string, Promise<Vacacion[]>>();
export function cargarPlaza(plaza: string): Promise<Vacacion[]> {
  const p = PLAZAS.find((x) => clave(x) === clave(plaza));
  if (!p) return Promise.resolve([]);
  if (!porPlaza.has(p)) {
    const pedido = leerFiltrado(COL_PLAZA, 'plaza', `select * where ${COL_PLAZA} = '${p}'`, (v) => clave(v.plaza) === clave(p))
      .then((l) => l.sort((a, b) => b.diasRestantes - a.diasRestantes))
      .catch((e) => {
        porPlaza.delete(p);
        throw e;
      });
    porPlaza.set(p, pedido);
  }
  return porPlaza.get(p)!;
}

export function plazaDeSesion(plaza?: string) {
  return PLAZAS.find((x) => clave(x) === clave(plaza)) || PLAZAS[0];
}

export function buscarVacaciones(lista: Vacacion[], texto: string, soloAsesor?: string) {
  const n = normalizarNombre(texto);
  const num = sinCeros(texto);
  const asesor = soloAsesor ? normalizarNombre(soloAsesor) : '';
  return lista.filter((v) => {
    if (asesor && normalizarNombre(v.asesor) !== asesor) return false;
    if (!n && !num) return true;
    if (num && /^\d+$/.test(texto.trim())) return sinCeros(v.numEmpleado).startsWith(num);
    return normalizarNombre(v.nombre).includes(n) || normalizarNombre(v.tienda).includes(n);
  });
}

// "Ya vencieron sus días" / "0 a 50 días": the previous period is about to be lost.
export function urgencia(v: Vacacion): 'vencido' | 'pronto' | null {
  const b = clave(v.venceAnterior);
  if (b === 'yavencieronsusdias') return 'vencido';
  if (b === '0a50dias') return 'pronto';
  return null;
}

// Date of the last Dashboard 5 upload, from the Configuracion tab (row s5).
let actualizado: Promise<string> | null = null;
export function fechaActualizacion(): Promise<string> {
  actualizado ??= leerCsv(CONFIG_TAB)
    .then((filas) => String(filas.find((r) => String(r[0] ?? '').trim() === CONFIG_ID)?.[3] ?? '').trim())
    .catch(() => {
      actualizado = null;
      return '';
    });
  return actualizado;
}
