// src/services/directory.ts
// Real directory contacts, fetched from Supabase (editable via the admin panel).
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
  const { data, error } = await supabase.rpc('list_directory_contacts');
  if (error) throw error;

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
