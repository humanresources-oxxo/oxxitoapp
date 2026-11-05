// src/services/sesion.ts
// Session key (migration_35_sesiones.sql): at login the app trades the PIN for
// a random key that stays on the phone, so publishing avisos, voting and
// managing votaciones don't ask for a passcode or PIN. The server only keeps
// its hash; a PIN change or reset ends it. Sessions from before the key
// existed get one the first time they need it (PIN once).
import { getJson, removeItem, setJson, storageKeys } from './appStorage';
import { supabase } from './supabaseClient';

// Puestos that publish avisos and create, close and delete votaciones: RH and
// Gerente de plaza. Same list as
// voto_puede_administrar in migration 34, which is what really enforces it;
// here it only decides what to show.
const PUESTOS_PUBLICAR = ['RESPONSABLE RECURSOS HUMANOS', 'ANALISTA EXPERIENCIA COLABORADOR', 'PRACTICANTE', 'GERENTE PLAZA'];

export function puedePublicar(puesto?: string) {
  const p = String(puesto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
  return !!p && PUESTOS_PUBLICAR.some((x) => p.startsWith(x));
}

export const leerLlave = () => getJson<string | null>(storageKeys.sessionKey, null);

// 'ok' (and keeps the key) | 'wrong_pin' | 'locked' | 'not_found'.
export async function obtenerLlave(numero: string, pin: string): Promise<string> {
  const { data, error } = await supabase.rpc('iniciar_sesion', { p_numero: numero, p_pin: pin });
  if (error) throw error;
  const fila = data?.[0];
  if (fila?.status === 'ok' && fila.token) await setJson(storageKeys.sessionKey, fila.token);
  return fila?.status ?? 'not_found';
}

export const olvidarLlave = () => removeItem(storageKeys.sessionKey);

// The DashboardsOxxo Apps Script (v65) answers this when the key is missing,
// expired or can't be checked: the screen asks for the PIN once and retries.
export const SIN_SESION = 'sesion_conoxxo';
export const esSinSesion = (e: unknown) => String((e as any)?.message ?? e).includes(SIN_SESION);

// Logout: ends the key on the server too (best effort) and forgets it.
export async function cerrarSesion() {
  const llave = await leerLlave();
  await olvidarLlave();
  if (llave) await supabase.rpc('cerrar_sesion', { p_token: llave }).then(() => {}, () => {});
}
