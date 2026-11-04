// src/services/notices.ts
// Real avisos, fetched from Supabase (empty until content is loaded there).
// Since migration 36 an aviso can carry up to 3 images (list_avisos gives
// their sizes, aviso_imagen each one's data), and RH / Gerente de plaza
// publish and delete them with the session key (services/sesion.ts).
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { supabase } from './supabaseClient';
import { Notice, NoticeKind } from '../data/notices';

const dateFormatter = new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export async function fetchNotices(): Promise<Notice[]> {
  // list_avisos (migration 36) also brings the images; before that
  // migration only list_notices exists.
  let { data, error } = await supabase.rpc('list_avisos');
  if (error) ({ data, error } = await supabase.rpc('list_notices'));
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    kind: row.kind as NoticeKind,
    priority: row.priority,
    read: false,
    date: dateFormatter.format(new Date(row.published_at)),
    images: row.imagenes ?? [],
  }));
}

// Image data as a data: URI, kept in memory once loaded.
const cache = new Map<string, Promise<string>>();
export function cargarImagenAviso(id: string): Promise<string> {
  let p = cache.get(id);
  if (!p) {
    p = (async () => {
      const { data, error } = await supabase.rpc('aviso_imagen', { p_id: id });
      if (error || !data?.[0]) throw error ?? new Error('sin imagen');
      return `data:${data[0].mime};base64,${data[0].data}`;
    })();
    p.catch(() => cache.delete(id));
    cache.set(id, p);
  }
  return p;
}

export type ImagenNueva = { uri: string; mime: string; data: string; width: number; height: number };

// Base64 limit per image in the database (~1 MB).
const MAX_BASE64 = 1_400_000;

// Picked photo -> JPEG with the longest side at most 1280 px (smaller and
// more compressed if still too big), with its Base64.
export async function prepararImagen(uri: string, width: number, height: number): Promise<ImagenNueva> {
  for (const [lado, calidad] of [
    [1280, 0.72],
    [1024, 0.6],
    [800, 0.5],
  ] as const) {
    const ctx = ImageManipulator.manipulate(uri);
    if (Math.max(width, height) > lado) ctx.resize(width >= height ? { width: lado } : { height: lado });
    const ref = await ctx.renderAsync();
    const r = await ref.saveAsync({ format: SaveFormat.JPEG, compress: calidad, base64: true });
    if (r.base64 && r.base64.length <= MAX_BASE64) {
      return { uri: r.uri, mime: 'image/jpeg', data: r.base64, width: r.width, height: r.height };
    }
  }
  throw new Error('imagen_grande');
}

// Returns 'ok' | 'no_session' | 'not_allowed' | 'bad_notice' | 'bad_image'.
export async function publishNotice(
  llave: string,
  title: string,
  body: string,
  kind: NoticeKind,
  priority: boolean,
  images: ImagenNueva[] = []
): Promise<string> {
  const { data, error } = await supabase.rpc('sesion_publicar_aviso', {
    p_token: llave,
    p_title: title,
    p_body: body,
    p_kind: kind,
    p_priority: priority,
    // Without images the parameter is left out, so it also works before migration 36.
    ...(images.length ? { p_imagenes: images.map(({ mime, data, width, height }) => ({ mime, data, width, height })) } : {}),
  });
  if (error) throw error;
  return (data as string) ?? 'not_found';
}

// Returns 'ok' | 'no_session' | 'not_allowed'.
export async function deleteNotice(llave: string, id: string): Promise<string> {
  const { data, error } = await supabase.rpc('sesion_borrar_aviso', { p_token: llave, p_id: id });
  if (error) throw error;
  return (data as string) ?? 'not_found';
}
