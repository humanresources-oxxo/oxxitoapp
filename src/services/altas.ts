// src/services/altas.ts
// New accounts waiting for approval (migration 39): a self-registered
// employee can't sign in until their asesor (roster asesor = their name),
// RH or the Gerente de plaza approves it. Rejecting frees the account so the
// real person can register. Goes with the session key (services/sesion.ts).
import { supabase } from './supabaseClient';

export type Alta = { numero: string; nombre: string; tienda: string; puesto: string; registradaEn: Date | null };

// Puestos that see "Altas por aprobar" (the server decides who can approve whom).
export function puedeAprobarAltas(puesto?: string) {
  const p = String(puesto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
  return ['RESPONSABLE RECURSOS HUMANOS', 'ANALISTA EXPERIENCIA COLABORADOR', 'GERENTE PLAZA', 'ASESOR TIENDA'].some((x) => p.startsWith(x));
}

// Also people given employee management one by one (accesos_especiales,
// migration 42), whatever their puesto: the server says so (sesion_panel).
export async function puedoAprobarAltas(puesto: string | undefined, llave: string | null): Promise<boolean> {
  if (puedeAprobarAltas(puesto)) return true;
  if (!llave) return false;
  const { data, error } = await supabase.rpc('sesion_panel', { p_token: llave });
  return !error && data?.estado === 'ok' && data.personal === true;
}

// null when the key is missing or no longer valid.
export async function listarAltas(llave: string): Promise<Alta[] | null> {
  const { data, error } = await supabase.rpc('sesion_altas_pendientes', { p_token: llave });
  if (error) throw error;
  if (data?.estado !== 'ok') return null;
  return (data.altas ?? []).map((a: any) => ({
    numero: a.numero,
    nombre: a.nombre,
    tienda: a.tienda ?? '',
    puesto: a.puesto ?? '',
    registradaEn: a.registrada_en ? new Date(a.registrada_en) : null,
  }));
}

// 'ok' | 'no_session' | 'not_allowed' | 'not_found'.
export async function resolverAlta(llave: string, numero: string, aprobar: boolean): Promise<string> {
  const { data, error } = await supabase.rpc('sesion_resolver_alta', { p_token: llave, p_numero: numero, p_aprobar: aprobar });
  if (error) throw error;
  return (data as string) ?? 'not_found';
}
