// src/services/estructura.ts
// Store structure from DashboardsOxxo's Dashboard 1 (tab Dashboard_1_Diario):
// every position of every store in the latest month cut, either occupied (with
// the employee's name) or vacant (with the date it opened). Same defaults as
// dashboard-1.html: operating stores only (no Entrenamiento/Operaciones units,
// no pre-openings) and its six default puestos. The AT comes from
// Catalogo_Asesores by CR when the store is there (applyAsesorCatalog in the web).
// If DashboardsOxxo renames the tab or its columns, update this file too.
import { clave, fechaConfiguracion, leerCsv, letra, normalizarNombre, plazaDe } from './gviz';
import { cargarTiendas, normalizarCr, normalizarTienda } from './tiendas';

const TAB = 'Dashboard_1_Diario';
const CONFIG_ID = 'd1';
// Same letters as DashboardsOxxo (SCOPED_GVIZ_COLUMNS: Plaza is A); checked
// against the header, with the whole tab as fallback.
const COL_PLAZA = 'A';
const COL_MES = 'K';

// METRICS_DEFAULT_PUESTOS_D1 in DashboardsOxxo js/core.js.
const PUESTOS = new Set(['ENCARGADO TURNO', 'ENCARGADO TURNO SATELITE', 'LIDER TIENDA', 'LIDER TIENDA SATELITE', 'AYUDANTE TIENDA', 'AYUDANTE TIENDA SATELITE']);
// PREOPENING_STORE_KEYS in js/core.js: announced stores that haven't opened.
const PREAPERTURAS = new Set(
  [
    'Parador Boca del Monte VSA',
    'Papaya VSA',
    'Small Beach OAX VSA',
    'Piedra Parada VSA',
    'Gas Nopala VSA',
    '5 de Septiembre VSA',
    'Union y Progreso VSA',
    'Gas Pancardo VSA',
    'Santa Gertrudis VSA',
    'Fuerza Aérea VSA',
  ].map(normalizarTienda)
);

export type Posicion = {
  id: string;
  puesto: string;
  empleado: string; // '' when vacant
  vacanteDesde: string; // AAAA-MM-DD when vacant
};
export type TiendaEstructura = {
  tienda: string;
  cr: string;
  asesor: string;
  plaza: string;
  posiciones: Posicion[];
  ocupadas: number;
  vacantes: number;
};
export type Corte = { mes: string; tiendas: TiendaEstructura[] };

const ALIAS = {
  plaza: ['Plaza'],
  asesor: ['Asesor'],
  tienda: ['Unidad org', 'Tienda'],
  cr: ['CR TIENDA', 'CR'],
  id: ['ID posiciones', 'ID posicion'],
  puesto: ['Descripcion de Posicion', 'Puesto'],
  status: ['Status ocupacion', 'Estatus ocupacion'],
  empleado: ['Empleados', 'Empleado'],
  fecha: ['Fecha'],
  mes: ['Mes'],
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

// "oct-26" -> "2026-10" (the Mes column), so months sort.
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export function mesClave(v: string) {
  const m = clave(v).match(/^([a-z]{3})[a-z]*(\d{2}|\d{4})$/);
  const i = m ? MESES.indexOf(m[1]) : -1;
  if (i < 0) return '';
  const a = m![2].length === 2 ? `20${m![2]}` : m![2];
  return `${a}-${String(i + 1).padStart(2, '0')}`;
}
export function mesTexto(v: string) {
  const k = mesClave(v);
  const nombres = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return k ? `${nombres[+k.slice(5) - 1]} ${k.slice(0, 4)}` : v;
}

// Latest month in the tab, asked to GViz as a small "group by" (a dozen rows).
async function mesVigente(): Promise<string> {
  const filas = await leerCsv(TAB, `select ${COL_MES}, count(${COL_PLAZA}) group by ${COL_MES}`);
  if (clave(filas[0]?.[0]) !== 'mes') throw new Error('columna Mes no encontrada');
  return filas
    .slice(1)
    .map((r) => String(r[0] ?? '').trim())
    .filter(mesClave)
    .sort((a, b) => mesClave(a).localeCompare(mesClave(b)))
    .pop() || '';
}

const vacante = (status: string, empleado: string) => /vacante|no ocupado/.test(clave(status)) || (!empleado && !!status);

function aCorte(filas: string[][], plaza: string, mes: string, asesorPorCr: Map<string, string>): TiendaEstructura[] {
  const idx = indices(filas[0] || []);
  const v = (r: string[], k: Col) => (idx[k] >= 0 ? String(r[idx[k]] ?? '').trim() : '');
  const tiendas = new Map<string, TiendaEstructura>();
  filas.slice(1).forEach((r) => {
    if (mes && v(r, 'mes') !== mes) return;
    if (plazaDe(v(r, 'plaza')) !== plaza) return;
    const tienda = v(r, 'tienda');
    const t = clave(tienda);
    if (!t || t === 'sintienda' || t.includes('entrenamiento') || t.includes('operaciones')) return;
    if (PREAPERTURAS.has(normalizarTienda(tienda))) return;
    const puesto = v(r, 'puesto').toUpperCase();
    if (!PUESTOS.has(puesto)) return;
    const cr = normalizarCr(v(r, 'cr'));
    const llave = cr || normalizarTienda(tienda);
    if (!tiendas.has(llave)) {
      const asesor = asesorPorCr.get(cr) || v(r, 'asesor');
      tiendas.set(llave, { tienda, cr, asesor, plaza, posiciones: [], ocupadas: 0, vacantes: 0 });
    }
    const item = tiendas.get(llave)!;
    const empleado = v(r, 'empleado');
    const libre = vacante(v(r, 'status'), empleado);
    item.posiciones.push({ id: v(r, 'id'), puesto, empleado: libre ? '' : empleado, vacanteDesde: libre ? v(r, 'fecha') : '' });
    if (libre) item.vacantes += 1;
    else item.ocupadas += 1;
  });
  const orden = ['LIDER', 'ENCARGADO', 'AYUDANTE'];
  const rango = (p: string) => orden.findIndex((o) => p.startsWith(o));
  return [...tiendas.values()]
    .map((t) => ({
      ...t,
      posiciones: t.posiciones.sort((a, b) => rango(a.puesto) - rango(b.puesto) || a.puesto.localeCompare(b.puesto) || a.empleado.localeCompare(b.empleado)),
    }))
    .sort((a, b) => b.vacantes - a.vacantes || a.tienda.localeCompare(b.tienda, 'es'));
}

let tabCompleta: Promise<string[][]> | null = null;
const porPlaza = new Map<string, Promise<Corte>>();

// One plaza of the latest cut (~1,500 positions). Never mixes months: if the
// latest month can't be read, the whole tab is read and the latest taken here.
export function cargarEstructura(plaza: string): Promise<Corte> {
  const p = plazaDe(plaza);
  if (!p) return Promise.resolve({ mes: '', tiendas: [] });
  if (!porPlaza.has(p)) {
    const pedido = (async () => {
      const catalogo = await cargarTiendas();
      const asesorPorCr = new Map(catalogo.map((t) => [t.cr, t.asesor]));
      try {
        const mes = await mesVigente();
        if (!mes) throw new Error('sin mes');
        const filas = await leerCsv(TAB, `select * where ${COL_PLAZA} = '${p}' and ${COL_MES} = '${mes}'`);
        const idx = indices(filas[0] || []);
        if (letra(idx.plaza) !== COL_PLAZA || letra(idx.mes) !== COL_MES) throw new Error('columnas movidas');
        return { mes, tiendas: aCorte(filas, p, mes, asesorPorCr) };
      } catch {
        tabCompleta ??= leerCsv(TAB).catch((e) => {
          tabCompleta = null;
          throw e;
        });
        const filas = await tabCompleta;
        const idx = indices(filas[0] || []);
        const mes =
          filas
            .slice(1)
            .map((r) => String(r[idx.mes] ?? '').trim())
            .filter(mesClave)
            .sort((a, b) => mesClave(a).localeCompare(mesClave(b)))
            .pop() || '';
        return { mes, tiendas: aCorte(filas, p, mes, asesorPorCr) };
      }
    })().catch((e) => {
      porPlaza.delete(p);
      throw e;
    });
    porPlaza.set(p, pedido);
  }
  return porPlaza.get(p)!;
}

export function buscarTiendas(tiendas: TiendaEstructura[], texto: string, soloAsesor?: string) {
  const n = normalizarNombre(texto);
  const cr = normalizarCr(texto);
  const asesor = soloAsesor ? normalizarNombre(soloAsesor) : '';
  return tiendas.filter((t) => {
    if (asesor && normalizarNombre(t.asesor) !== asesor) return false;
    if (!n && !cr) return true;
    return (
      normalizarNombre(t.tienda).includes(n) ||
      (!!cr && t.cr.startsWith(cr)) ||
      t.posiciones.some((p) => p.empleado && normalizarNombre(p.empleado).includes(n))
    );
  });
}

export function totales(tiendas: TiendaEstructura[]) {
  const ocupadas = tiendas.reduce((s, t) => s + t.ocupadas, 0);
  const vacantes = tiendas.reduce((s, t) => s + t.vacantes, 0);
  const total = ocupadas + vacantes;
  return { tiendas: tiendas.length, ocupadas, vacantes, total, cobertura: total ? ocupadas / total : 0 };
}

// Whole days since the position opened (the sheet's "Dias Vacantes" column
// comes as a broken date, so it is computed from "Fecha").
export function diasVacante(desde: string, hoy = new Date()) {
  const m = desde.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const inicio = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  const fin = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return Math.max(0, Math.round((fin - inicio) / 86400000));
}

// Date of the last Dashboard 1 upload, from the Configuracion tab (row d1).
export const fechaActualizacion = () => fechaConfiguracion(CONFIG_ID);
