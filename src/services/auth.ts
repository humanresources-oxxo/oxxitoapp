// src/services/auth.ts
// Employee login backed by Supabase RPCs against the real roster (employees table).
import { supabase } from './supabaseClient';

export type EmployeeLookup = {
  exists: boolean;
  nombre?: string;
  hasPin?: boolean;
  tienda?: string;
  plaza?: string;
  asesor?: string;
  puesto?: string;
  createdAt?: string;
  // RH loaded the birth date: the first registration asks for it (migration 38).
  pideFecha?: boolean;
};
export type Employee = { numeroEmpleado: string; nombre: string };

export async function lookupEmployee(numeroEmpleado: string): Promise<EmployeeLookup> {
  const { data, error } = await supabase.rpc('employee_lookup', { p_numero: numeroEmpleado });
  if (error) throw error;
  const row = data?.[0];
  if (!row) return { exists: false };
  return {
    exists: true,
    nombre: row.nombre,
    hasPin: row.has_pin,
    tienda: row.tienda,
    plaza: row.plaza,
    asesor: row.asesor,
    puesto: row.puesto,
    createdAt: row.created_at,
    pideFecha: !!row.pide_fecha,
  };
}

// First PIN (migration 38): needs the birth date RH loaded ('YYYY-MM-DD').
export type RegisterPinResult =
  | 'ok'
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
  if (row.status === 'ok')
    return { status: 'ok', numeroEmpleado: row.numero_empleado, nombre: row.nombre, pinIsTemporary: !!row.pin_is_temporary };
  return { status: 'wrong_pin' };
}
