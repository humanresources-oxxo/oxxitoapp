// src/services/notices.ts
// Real avisos, fetched from Supabase (empty until content is loaded there).
import { supabase } from './supabaseClient';
import { Notice, NoticeKind } from '../data/notices';

const dateFormatter = new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export async function fetchNotices(): Promise<Notice[]> {
  const { data, error } = await supabase.rpc('list_notices');
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    kind: row.kind as NoticeKind,
    priority: row.priority,
    read: false,
    date: dateFormatter.format(new Date(row.published_at)),
  }));
}

// RH and Gerente de plaza publish with their session key (services/sesion.ts,
// migration 35). Returns 'ok' | 'no_session' | 'not_allowed' | 'bad_notice'.
export async function publishNotice(llave: string, title: string, body: string, kind: NoticeKind, priority: boolean): Promise<string> {
  const { data, error } = await supabase.rpc('sesion_publicar_aviso', {
    p_token: llave,
    p_title: title,
    p_body: body,
    p_kind: kind,
    p_priority: priority,
  });
  if (error) throw error;
  return (data as string) ?? 'not_found';
}
