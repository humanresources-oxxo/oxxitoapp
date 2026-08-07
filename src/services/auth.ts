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
  };
}

export async function setInitialPin(numeroEmpleado: string, pin: string): Promise<Employee> {
  const { data, error } = await supabase.rpc('set_initial_pin', { p_numero: numeroEmpleado, p_pin: pin });
  if (error) throw error;
  const row = data?.[0];
  return { numeroEmpleado: row.numero_empleado, nombre: row.nombre };
}

export type RequestEmailCodeResult = 'sent' | 'already_has_pin' | 'rate_limited' | 'not_found';
export type VerifyEmailCodeResult = 'ok' | 'wrong_code' | 'expired' | 'too_many_attempts' | 'not_found';

export async function requestEmailCode(numeroEmpleado: string, email: string): Promise<RequestEmailCodeResult> {
  const { data, error } = await supabase.rpc('request_email_code', { p_numero: numeroEmpleado, p_email: email });
  if (error) throw error;
  return (data?.[0]?.status as RequestEmailCodeResult) ?? 'not_found';
}

export async function verifyEmailCode(
  numeroEmpleado: string,
  email: string,
  code: string
): Promise<VerifyEmailCodeResult> {
  const { data, error } = await supabase.rpc('verify_email_code', {
    p_numero: numeroEmpleado,
    p_email: email,
    p_code: code,
  });
  if (error) throw error;
  return (data?.[0]?.status as VerifyEmailCodeResult) ?? 'not_found';
}

export type VerifyPinResult =
  | { status: 'ok'; numeroEmpleado: string; nombre: string }
  | { status: 'wrong_pin' }
  | { status: 'locked'; lockedUntil: string }
  | { status: 'not_found' };

export type ChangePinResult = 'ok' | 'wrong_pin' | 'locked' | 'not_found';

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
    return { status: 'ok', numeroEmpleado: row.numero_empleado, nombre: row.nombre };
  return { status: 'wrong_pin' };
}
