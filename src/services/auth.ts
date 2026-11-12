// src/services/auth.ts
// Employee login backed by Supabase RPCs against the real roster (employees table).
import { getJson, setJson, storageKeys } from './appStorage';
import { leerLlave } from './sesion';
import { supabase } from './supabaseClient';

// What the login screen may know from a number alone (acceso_empleado,
// migration 52): where to go next and the first name for the greeting. The
// rest of the profile needs the session key (miPerfil).
export type EmployeeLookup = {
  exists: boolean;
  primerNombre?: string;
  hasPin?: boolean;
  // RH loaded the birth date: the first registration asks for it (migration 38).
  pideFecha?: boolean;
};
export type Employee = { numeroEmpleado: string; nombre: string };

export async function lookupEmployee(numeroEmpleado: string): Promise<EmployeeLookup> {
  const { data, error } = await supabase.rpc('acceso_empleado', { p_numero: numeroEmpleado });
  if (error) throw error;
  const row = data?.[0];
  if (!row) return { exists: false };
  return { exists: true, primerNombre: row.primer_nombre, hasPin: row.has_pin, pideFecha: !!row.pide_fecha };
}

export type Perfil = { numeroEmpleado: string; nombre: string; tienda?: string; plaza?: string; asesor?: string; puesto?: string; createdAt?: string };

// One's own data, with the session key (sesion_mi_perfil, migration 52).
// null: there is no key, or the server no longer accepts it.
export async function miPerfil(): Promise<Perfil | null> {
  const llave = await leerLlave();
  if (!llave) return null;
  const { data, error } = await supabase.rpc('sesion_mi_perfil', { p_token: llave });
  if (error) throw error;
  if (data?.estado !== 'ok') return null;
  return {
    numeroEmpleado: data.numero,
    nombre: data.nombre,
    tienda: data.tienda ?? undefined,
    plaza: data.plaza ?? undefined,
    asesor: data.asesor ?? undefined,
    puesto: data.puesto ?? undefined,
    createdAt: data.created_at ?? undefined,
  };
}

// Another employee's name, puesto and tienda, for the acta administrativa
// (sesion_buscar_empleado, migration 52: only puestos with permisos).
// 'not_found' | 'not_allowed' | 'no_session' when there is nothing to show.
export async function buscarEmpleado(numeroEmpleado: string): Promise<{ estado: string; nombre?: string; puesto?: string; tienda?: string }> {
  const llave = await leerLlave();
  if (!llave) return { estado: 'no_session' };
  const { data, error } = await supabase.rpc('sesion_buscar_empleado', { p_token: llave, p_numero: numeroEmpleado });
  if (error) throw error;
  return data ?? { estado: 'not_found' };
}

// First PIN (migration 38): needs the birth date RH loaded ('YYYY-MM-DD').
export type RegisterPinResult =
  | 'ok'
  // Registered; the account waits for its asesor / RH (migration 39).
  | 'pendiente'
  | 'not_found'
  | 'pin_already_set'
  | 'weak_pin'
  | 'rh_asigna_pin'
  | 'sin_fecha'
  | 'fecha_incorrecta'
  | 'rate_limited';

export async function registerPin(numeroEmpleado: string, fechaNacimiento: string, pin: string): Promise<RegisterPinResult> {
  const { data, error } = await supabase.rpc('registrar_pin', { p_numero: numeroEmpleado, p_fecha: fechaNacimiento, p_pin: pin });
  if (error) throw error;
  return (data as RegisterPinResult) ?? 'not_found';
}

export type VerifyPinResult =
  // pinIsTemporary: RH gave this PIN (reset or new employee); the app makes
  // the employee replace it before going in.
  | { status: 'ok'; numeroEmpleado: string; nombre: string; pinIsTemporary: boolean }
  | { status: 'wrong_pin' }
  | { status: 'locked'; lockedUntil: string }
  // Self-registered, waiting for its asesor / RH to approve it (migration 39).
  | { status: 'pendiente' }
  | { status: 'not_found' };

// weak_pin: 1234, 0000 and the like are refused (migration 37).
export type ChangePinResult = 'ok' | 'wrong_pin' | 'locked' | 'not_found' | 'weak_pin';

export async function changePin(numeroEmpleado: string, oldPin: string, newPin: string): Promise<ChangePinResult> {
  const { data, error } = await supabase.rpc('change_pin', {
    p_numero: numeroEmpleado,
    p_old_pin: oldPin,
    p_new_pin: newPin,
  });
  if (error) throw error;
  return (data?.[0]?.status as ChangePinResult) ?? 'not_found';
}

export async function verifyPin(numeroEmpleado: string, pin: string): Promise<VerifyPinResult> {
  const { data, error } = await supabase.rpc('verify_pin', { p_numero: numeroEmpleado, p_pin: pin });
  if (error) throw error;
  const row = data?.[0];
  if (!row || row.status === 'not_found') return { status: 'not_found' };
  if (row.status === 'locked') return { status: 'locked', lockedUntil: row.locked_until };
  if (row.status === 'pendiente') return { status: 'pendiente' };
  if (row.status === 'ok')
    return { status: 'ok', numeroEmpleado: row.numero_empleado, nombre: row.nombre, pinIsTemporary: !!row.pin_is_temporary };
  return { status: 'wrong_pin' };
}

// Saves the session on the phone at the end of the login. The profile comes
// with the session key (migration 52); if it cannot be read now, the session
// starts with what the login knows (the first name) and the app completes it
// on open (MainTabsNavigator revalidarSesion).
export async function guardarSesionLocal(base: { numeroEmpleado: string; nombre: string; tienda?: string; plaza?: string; puesto?: string; createdAt?: string }) {
  const p = await miPerfil().catch(() => null);
  await setJson(storageKeys.session, {
    numeroEmpleado: base.numeroEmpleado,
    nombre: p?.nombre ?? base.nombre,
    tienda: p?.tienda ?? base.tienda,
    plaza: p?.plaza ?? base.plaza,
    puesto: p?.puesto ?? base.puesto,
    createdAt: p?.createdAt ?? base.createdAt,
  });
}

// Who already accepted the terms on this phone: they are not asked again at
// every login. Only employee numbers; kept through a logout on purpose (it is
// not in storageKeys, which the logout erases).
const TERMINOS_ACEPTADOS = 'oxxito:terminosAceptados';
export async function yaAceptoTerminos(numeroEmpleado: string) {
  return (await getJson<string[]>(TERMINOS_ACEPTADOS, [])).includes(numeroEmpleado);
}
export async function recordarTerminos(numeroEmpleado: string) {
  const lista = await getJson<string[]>(TERMINOS_ACEPTADOS, []);
  if (!lista.includes(numeroEmpleado)) await setJson(TERMINOS_ACEPTADOS, [...lista, numeroEmpleado].slice(-50));
}
