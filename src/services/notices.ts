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

export async function createNotice(
  passcode: string,
  title: string,
  body: string,
  kind: NoticeKind,
  priority: boolean
): Promise<void> {
  const { error } = await supabase.rpc('create_notice', {
    p_passcode: passcode,
    p_title: title,
    p_body: body,
    p_kind: kind,
    p_priority: priority,
  });
  if (error) throw error;
}
