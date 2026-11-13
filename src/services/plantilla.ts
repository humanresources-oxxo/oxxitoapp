// src/services/plantilla.ts
// Who is on each store's team, from DashboardsOxxo's tab Plantilla_Demograficos
// (the weekly "Plantilla Operativa con Demograficos", uploaded from the admin
// panel): one row per active collaborator with gender, age, birthday month and
// seniority date. Estructura shows it as "Equipo", next to the vacancies of
// Dashboard 1. Plaza Oaxaca only.
// The panel never publishes RFC, CURP, IMSS, phone, address, salary or the
// birth date (only the age and the birthday MONTH: with the day, age + day
// would give the full date, which is what the first PIN asks for), and the
// Apps Script only serves the tab to puestos with permisos (v72).
// If DashboardsOxxo renames the tab or its columns, update this file too.
import { clave, esPlaza, fechaConfiguracion, leerCsv, letra, normalizarNombre, PLAZA } from './gviz';
import { esSinSesion } from './sesion';
import { normalizarCr, normalizarTienda } from './tiendas';

const TAB = 'Plantilla_Demograficos';
const CONFIG_ID = 'plantilla';
// Plaza is the second column (Region, Plaza, ...); checked against the header,
// with the whole tab as fallback.
const COL_PLAZA = 'B';

export type Colaborador = {
  numero: string;
  nombre: string;
  tienda: string;
  cr: string;
  asesor: string;
  puesto: string; // "Ayudante Tienda" | "Encargado" | "Lider"
  situacion: string; // "Dentro de Tienda", "Incapacidad", "Banca", ...
  desde: string; // seniority date, AAAA-MM-DD ('' if unknown)
  sexo: 'F' | 'M' | '';
  edad: number | null;
  mesCumple: number | null; // 1-12
};
export type Plantilla = { semana: string; colaboradores: Colaborador[] };

const ALIAS = {
  plaza: ['Plaza'],
  asesor: ['Asesor'],
  cr: ['Cr de tienda', 'CR TIENDA', 'CR'],
  tienda: ['Tienda', 'Unidad org'],
  numero: ['Nº personal', 'N personal', 'No Empleado'],
  nombre: ['Empleados', 'Empleado', 'Nombre'],
  puesto: ['Puesto Homologado', 'Puesto'],
  situacion: ['HC Operativos', 'Situacion'],
  desde: ['Fecha Antiguedad'],
  sexo: ['Sexo', 'Genero'],
  edad: ['Edad'],
  mesCumple: ['Mes Cumple'],
  semana: ['Semana'],
};
type Col = keyof typeof ALIAS;

function indices(encabezado: string[]) {
  const claves = encabezado.map(clave);
  const idx = {} as Record<Col, number>;
  (Object.keys(ALIAS) as Col[]).forEach((k) => {
    idx[k] = claves.findIndex((h) => ALIAS[k].some((a) => clave(a) === h));
  });
  return idx;
}

// The panel stores it as text AAAA-MM-DD; a sheet edited by hand may show
// DD/MM/AAAA.
export function fechaIso(v: string): string {
  const t = String(v ?? '').trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = t.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return '';
}

const entero = (v: string, min: number, max: number) => {
  const n = Number(String(v ?? '').trim());
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};

export function aColaboradores(filas: string[][]): Plantilla {
  const idx = indices(filas[0] || []);
  const v = (r: string[], k: Col) => (idx[k] >= 0 ? String(r[idx[k]] ?? '').trim() : '');
  let semana = '';
  const vistos = new Set<string>();
  const colaboradores: Colaborador[] = [];
  filas.slice(1).forEach((r) => {
    if (!esPlaza(v(r, 'plaza'))) return;
    const numero = v(r, 'numero').replace(/\.0+$/, '');
    const nombre = v(r, 'nombre');
    if (!numero || !nombre || vistos.has(numero)) return;
    vistos.add(numero);
    semana ||= v(r, 'semana');
    const s = clave(v(r, 'sexo'));
    colaboradores.push({
      numero,
      nombre,
      tienda: v(r, 'tienda'),
      cr: normalizarCr(v(r, 'cr')),
      asesor: v(r, 'asesor'),
      puesto: v(r, 'puesto'),
      situacion: v(r, 'situacion'),
      desde: fechaIso(v(r, 'desde')),
      sexo: s.startsWith('f') || s.startsWith('muj') ? 'F' : s.startsWith('m') || s.startsWith('hom') ? 'M' : '',
      edad: entero(v(r, 'edad'), 15, 100),
      mesCumple: entero(v(r, 'mesCumple'), 1, 12),
    });
  });
  return { semana, colaboradores };
}

let plantilla: Promise<Plantilla | null> | null = null;

// null: there is no plantilla to show yet (the tab has not been uploaded, or
// the Apps Script is older than v72). A rejected session is thrown, so the
// screen asks for the PIN like the rest of Estructura.
export function cargarPlantilla(): Promise<Plantilla | null> {
  plantilla ??= (async () => {
    try {
      let filas = await leerCsv(TAB, `select * where ${COL_PLAZA} = '${PLAZA}'`);
      const idx = indices(filas[0] || []);
      // Column moved, or the plaza is written another way ("OXXO OAXACA"): whole tab.
      if (letra(idx.plaza) !== COL_PLAZA || filas.length < 2) filas = await leerCsv(TAB);
      const p = aColaboradores(filas);
      return p.colaboradores.length ? p : null;
    } catch (e) {
      if (esSinSesion(e)) throw e;
      return null;
    }
  })().catch((e) => {
    plantilla = null;
    throw e;
  });
  // A "nothing yet" answer is not kept: the next visit asks again.
  plantilla.then((p) => {
    if (!p) plantilla = null;
  }, () => {});
  return plantilla;
}

// Date of the last upload, from the Configuracion tab (row "plantilla").
export const fechaPlantilla = () => fechaConfiguracion(CONFIG_ID);

// --- Numbers for the screen ------------------------------------------------

const DIA = 86400000;
// Whole days since the seniority date (null if unknown or in the future).
export function diasDesde(desde: string, hoy = new Date()) {
  const m = desde.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const d = Math.round((Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()) - Date.UTC(+m[1], +m[2] - 1, +m[3])) / DIA);
  return d >= 0 ? d : null;
}

// "3 meses", "1 año 4 meses", "6 años" (under a month: "12 días").
export function textoAntiguedad(dias: number | null) {
  if (dias === null) return '';
  if (dias < 31) return dias === 1 ? '1 día' : `${dias} días`;
  const meses = Math.floor(dias / 30.4375);
  const a = Math.floor(meses / 12), m = meses % 12;
  const anios = a ? `${a} ${a === 1 ? 'año' : 'años'}` : '';
  const resto = m && a < 5 ? `${m} ${m === 1 ? 'mes' : 'meses'}` : '';
  return [anios, resto].filter(Boolean).join(' ');
}

export const RANGOS_EDAD = ['18 a 24 años', '25 a 29 años', '30 a 39 años', '40 a 49 años', '50 años o más'] as const;
const rangoEdad = (e: number) => (e < 25 ? 0 : e < 30 ? 1 : e < 40 ? 2 : e < 50 ? 3 : 4);
export const RANGOS_ANTIGUEDAD = ['Menos de 3 meses', '3 a 12 meses', '1 a 3 años', '3 a 5 años', '5 años o más'] as const;
const rangoAntiguedad = (d: number) => (d < 91 ? 0 : d < 365 ? 1 : d < 1096 ? 2 : d < 1826 ? 3 : 4);
// New on the team: under 3 months (first range).
export const esNuevo = (c: Colaborador, hoy = new Date()) => {
  const d = diasDesde(c.desde, hoy);
  return d !== null && d < 91;
};

const mediana = (xs: number[]) => {
  if (!xs.length) return null;
  const o = [...xs].sort((a, b) => a - b);
  const i = Math.floor(o.length / 2);
  return o.length % 2 ? o[i] : (o[i - 1] + o[i]) / 2;
};

export type ResumenEquipo = {
  total: number;
  mujeres: number;
  hombres: number;
  // Share of women per puesto, in the order Líder, Encargado, Ayudante.
  porPuesto: Array<{ puesto: string; total: number; mujeres: number }>;
  edades: number[]; // count per RANGOS_EDAD
  edadPromedio: number | null;
  antiguedades: number[]; // count per RANGOS_ANTIGUEDAD
  antiguedadMediana: number | null; // days
  nuevos: number;
  // Not working in the store right now, by reason (Incapacidad, Banca, ...).
  fueraDeTienda: Array<{ situacion: string; total: number }>;
  cumpleMes: Colaborador[];
};

const ORDEN_PUESTO = ['lider', 'encargado', 'ayudante'];
const rangoPuesto = (p: string) => {
  const i = ORDEN_PUESTO.findIndex((o) => clave(p).startsWith(o));
  return i < 0 ? ORDEN_PUESTO.length : i;
};

export function resumenEquipo(cols: Colaborador[], hoy = new Date()): ResumenEquipo {
  const puestos = new Map<string, { puesto: string; total: number; mujeres: number }>();
  const situaciones = new Map<string, number>();
  const edades = RANGOS_EDAD.map(() => 0);
  const antiguedades = RANGOS_ANTIGUEDAD.map(() => 0);
  const dias: number[] = [];
  let mujeres = 0, hombres = 0, sumaEdad = 0, conEdad = 0;
  cols.forEach((c) => {
    if (c.sexo === 'F') mujeres += 1;
    else if (c.sexo === 'M') hombres += 1;
    const p = puestos.get(c.puesto) || { puesto: c.puesto || 'Sin puesto', total: 0, mujeres: 0 };
    p.total += 1;
    if (c.sexo === 'F') p.mujeres += 1;
    puestos.set(c.puesto, p);
    if (c.edad !== null) {
      edades[rangoEdad(c.edad)] += 1;
      sumaEdad += c.edad;
      conEdad += 1;
    }
    const d = diasDesde(c.desde, hoy);
    if (d !== null) {
      antiguedades[rangoAntiguedad(d)] += 1;
      dias.push(d);
    }
    if (c.situacion && clave(c.situacion) !== 'dentrodetienda') situaciones.set(c.situacion, (situaciones.get(c.situacion) || 0) + 1);
  });
  const mes = hoy.getMonth() + 1;
  return {
    total: cols.length,
    mujeres,
    hombres,
    porPuesto: [...puestos.values()].sort((a, b) => rangoPuesto(a.puesto) - rangoPuesto(b.puesto) || b.total - a.total),
    edades,
    edadPromedio: conEdad ? sumaEdad / conEdad : null,
    antiguedades,
    antiguedadMediana: mediana(dias),
    nuevos: antiguedades[0],
    fueraDeTienda: [...situaciones].map(([situacion, total]) => ({ situacion, total })).sort((a, b) => b.total - a.total),
    cumpleMes: cols.filter((c) => c.mesCumple === mes).sort((a, b) => a.tienda.localeCompare(b.tienda, 'es') || a.nombre.localeCompare(b.nombre, 'es')),
  };
}

// The collaborators of the given stores (by CR, or by name when the row has no CR).
export function delAlcance(cols: Colaborador[], tiendas: Array<{ cr: string; tienda: string }>) {
  const crs = new Set(tiendas.map((t) => t.cr).filter(Boolean));
  const nombres = new Set(tiendas.map((t) => normalizarTienda(t.tienda)));
  return cols.filter((c) => (c.cr ? crs.has(c.cr) : nombres.has(normalizarTienda(c.tienda))));
}

// Stores whose team is mostly new (under 3 months), largest share first.
// Teams of fewer than 3 are left out: one new person would read as 50-100%.
export function tiendasConEquipoNuevo(cols: Colaborador[], hoy = new Date()) {
  const m = new Map<string, { cr: string; tienda: string; total: number; nuevos: number }>();
  cols.forEach((c) => {
    const k = c.cr || normalizarTienda(c.tienda);
    const t = m.get(k) || { cr: c.cr, tienda: c.tienda, total: 0, nuevos: 0 };
    t.total += 1;
    if (esNuevo(c, hoy)) t.nuevos += 1;
    m.set(k, t);
  });
  return [...m.values()]
    .filter((t) => t.total >= 3 && t.nuevos / t.total >= 0.4)
    .sort((a, b) => b.nuevos / b.total - a.nuevos / a.total || b.nuevos - a.nuevos || a.tienda.localeCompare(b.tienda, 'es'));
}

// Seniority of each person of a store by name, to show it next to the
// position in Estructura (Dashboard 1 has the name, not the employee number).
export function antiguedadPorNombre(cols: Colaborador[], hoy = new Date()) {
  const m = new Map<string, string>();
  cols.forEach((c) => {
    const t = textoAntiguedad(diasDesde(c.desde, hoy));
    if (t) m.set(normalizarNombre(c.nombre), t);
  });
  return m;
}
