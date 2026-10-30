// src/services/tiendas.ts
// Store catalog (Catalogo_Asesores of DashboardsOxxo): store name, CR and its
// AT. Actas need it so they are sent with the store's CR, which is how RH's
// register groups actas by store (the web form sends it too); without the CR
// an app acta would show up as a separate store in the admin panel.
// Same sources as the web, in order: the live sheet through the Apps Script,
// then the versioned CSV on GitHub Pages, then the last copy saved on the phone.
import { getJson, setJson, storageKeys } from './appStorage';
import { parsearCsv } from './gviz';

const READ_SHEET_URL =
  'https://script.google.com/macros/s/AKfycbwe_RcnVRkZy9x1YcRuum4qdLucIWLTVsnTZcMvQDyobo6f3ot-YG0Lv00hYS-1XEg/exec?action=readSheet&sheet=Catalogo_Asesores';
const CSV_URL = 'https://humanresources-oxxo.github.io/DashboardsOxxo/assets/catalogo_asesores.csv';

export type Tienda = { tienda: string; cr: string; asesor: string };

const sinAcentos = (v: unknown) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
export const normalizarCr = (v: unknown) => sinAcentos(v).toUpperCase().replace(/[^A-Z0-9]/g, '');
// Same as normalizeCatalogTienda in DashboardsOxxo js/core.js: "OXXO Las Flores"
// and "Las Flores OAX" are the same store.
export function normalizarTienda(v: unknown) {
  return sinAcentos(v)
    .toUpperCase()
    .replace(/^OXXO\s+/, '')
    .replace(/^TIENDA\s+/, '')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s(OAX|VSA)$/, '');
}

// Mirrors validCatalogRow (web): drops headers, group rows and bad CRs.
function filaValida(asesor: string, tienda: string, cr: string) {
  const a = normalizarTienda(asesor);
  return !!a && !!normalizarTienda(tienda) && /^[A-Z0-9]{4,8}$/.test(normalizarCr(cr)) && !a.startsWith('ASESORES') && a !== 'ASESOR';
}

function aTiendas(valores: string[][]): Tienda[] {
  const filas = valores.length && valores[0].every((c) => String(c ?? '').trim() === '_buffer_') ? valores.slice(1) : valores;
  const enc = (filas[0] || []).map((h) => sinAcentos(h).trim().toUpperCase().replace(/[^A-Z0-9]+/g, ' '));
  const col = (fallback: number, ...alias: string[]) => {
    const i = enc.findIndex((h) => alias.includes(h));
    return i >= 0 ? i : fallback;
  };
  const iAsesor = col(0, 'ASESOR'), iTienda = col(1, 'TIENDA'), iCr = col(2, 'CR TIENDA', 'CR'), iActiva = col(-1, 'ACTIVA');
  const vistos = new Set<string>();
  return filas
    .slice(1)
    .map((r) => ({
      asesor: String(r[iAsesor] ?? '').trim(),
      tienda: String(r[iTienda] ?? '').trim(),
      cr: normalizarCr(r[iCr]),
      activa: iActiva >= 0 ? String(r[iActiva] ?? '').trim().toUpperCase() : '',
    }))
    .filter((t) => filaValida(t.asesor, t.tienda, t.cr) && !/^(NO|FALSE|FALSO|0|INACTIVA|INACTIVO|BAJA)$/.test(t.activa))
    .filter((t) => !vistos.has(t.cr) && !!vistos.add(t.cr))
    .map(({ tienda, cr, asesor }) => ({ tienda, cr, asesor }))
    .sort((a, b) => a.tienda.localeCompare(b.tienda, 'es'));
}

async function conTiempo(url: string, ms: number) {
  const control = new AbortController();
  const t = setTimeout(() => control.abort(), ms);
  try {
    const r = await fetch(url, { signal: control.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r;
  } finally {
    clearTimeout(t);
  }
}

async function desdeHoja() {
  const datos = await (await conTiempo(READ_SHEET_URL, 8000)).json();
  if (!datos?.ok || !Array.isArray(datos.values)) throw new Error('respuesta inválida');
  return aTiendas(datos.values);
}
async function desdeCsv() {
  return aTiendas(parsearCsv(await (await conTiempo(CSV_URL, 8000)).text()));
}

let enMemoria: Promise<Tienda[]> | null = null;

// Never rejects: with no network and no saved copy it returns [] and the
// store is typed by hand (the acta is then registered without CR).
export function cargarTiendas(): Promise<Tienda[]> {
  enMemoria ??= (async () => {
    for (const fuente of [desdeHoja, desdeCsv]) {
      try {
        const tiendas = await fuente();
        if (tiendas.length) {
          setJson(storageKeys.storeCatalog, tiendas);
          return tiendas;
        }
      } catch {
        // next source
      }
    }
    enMemoria = null; // retry next time the screen opens
    return getJson<Tienda[]>(storageKeys.storeCatalog, []);
  })();
  return enMemoria;
}

export function buscarTienda(tiendas: Tienda[], texto?: string) {
  const n = normalizarTienda(texto);
  if (!n) return null;
  return tiendas.find((t) => normalizarTienda(t.tienda) === n) || tiendas.find((t) => t.cr === normalizarCr(texto)) || null;
}

// AT of a store per Catalogo_Asesores (by CR, else by name), as the
// dashboards correct the sheets' own Asesor column (resolveAsesor in js/core.js).
// '' when the store isn't in the catalog.
export function asesorDelCatalogo(tiendas: Tienda[], { cr, tienda }: { cr?: string; tienda?: string }) {
  const c = normalizarCr(cr);
  const n = normalizarTienda(tienda);
  const exacta = (c && tiendas.find((t) => t.cr === c)?.asesor) || (n && tiendas.find((t) => normalizarTienda(t.tienda) === n)?.asesor);
  if (exacta) return exacta;
  // Payroll reports cut store names at 25 characters ("OXXO SAN JOSE DEL PROGRES"):
  // a long name that starts exactly one catalog store is that store.
  if (String(tienda ?? '').trim().length < 25 || n.length < 12) return '';
  const inicio = tiendas.filter((t) => normalizarTienda(t.tienda).startsWith(n));
  return inicio.length === 1 ? inicio[0].asesor : '';
}

export function sugerirTiendas(tiendas: Tienda[], texto?: string, max = 6) {
  const n = normalizarTienda(texto);
  if (!n) return [];
  const cr = normalizarCr(texto);
  const empiezan = tiendas.filter((t) => normalizarTienda(t.tienda).startsWith(n) || t.cr.startsWith(cr));
  const contienen = tiendas.filter((t) => !empiezan.includes(t) && normalizarTienda(t.tienda).includes(n));
  return [...empiezan, ...contienen].slice(0, max);
}
