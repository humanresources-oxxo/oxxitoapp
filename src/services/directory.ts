// src/services/directory.ts
// Real directory contacts, fetched from Supabase (editable via the admin panel).
// Read with the session key since migration 49.
import { rpcSesion } from './sesion';
import { supabase } from './supabaseClient';

export type Contact = {
  id: string;
  name: string;
  area: string;
  role: string;
  phone: string;
  schedule: string;
  tags: string[];
  urgent?: boolean;
};

export async function fetchContacts(): Promise<Contact[]> {
  const data = await rpcSesion<any[]>('sesion_directorio');

  return (data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    area: row.area,
    role: row.role,
    phone: row.phone,
    schedule: row.schedule,
    tags: row.tags ?? [],
    urgent: row.urgent,
  }));
}

// "Olvidé mi PIN" on the login screen: there is no session there, so it only
// gets the RH reception contact (contacto_recuperar_pin, migration 49).
export async function contactoRecuperarPin(): Promise<{ name: string; phone: string } | null> {
  const { data, error } = await supabase.rpc('contacto_recuperar_pin');
  if (error) throw error;
  return data?.[0] ?? null;
}
