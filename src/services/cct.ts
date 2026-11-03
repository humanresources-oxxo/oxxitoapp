// src/services/cct.ts
// Contratos colectivos (CCT): app-only data, not in any dashboard. RH uploads
// the CCT Excel from DashboardsOxxo's admin panel (js/cct-conoxxo.js there
// normalizes it; migration 32 stores it) and the app reads it with the list_cct RPC. It covers every OXXO
// plaza in the country: the screen shows Plaza Oaxaca's contract and how it
// compares with the rest. Indicators only: no names of responsables or links.
import { clave } from './gviz';
import { supabase } from './supabaseClient';

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
    const { data, error } = await supabase.rpc('list_cct');
    if (error) throw error;
    const filas = (data ?? []) as Array<{ hoja: string; datos: CctDatos; archivo: string | null; cargado_el: string }>;
    return {
      historico: filas.filter((f) => f.hoja === 'historico').map((f) => f.datos),
      ejercicio: filas.filter((f) => f.hoja === 'ejercicio').map((f) => f.datos),
      cargadoEl: filas[0]?.cargado_el ?? '',
      archivo: filas[0]?.archivo ?? '',
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
