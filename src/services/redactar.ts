// src/services/redactar.ts
// "Mejorar redacción" for avisos: Claude Haiku rewrites the title and text
// (worker/redactar.js, POST /api/redactar). Only a suggestion: the composer
// shows it and the person chooses whether to use it.
import { Platform } from 'react-native';
import { leerLlave } from './sesion';

const PATH = '/api/redactar';
const URL = Platform.OS === 'web' ? PATH : 'https://conoxxo.plaza-oaxaca.workers.dev' + PATH;

export type Sugerencia = { titulo: string; texto: string; cambios: string };
export type ResultadoRedaccion =
  | { ok: true; sugerencia: Sugerencia }
  | { ok: false; motivo: 'sin_sesion' | 'no_activa' | 'no_habilitado' | 'limite' | 'error' };

export async function mejorarRedaccion(titulo: string, texto: string): Promise<ResultadoRedaccion> {
  const llave = await leerLlave();
  if (!llave) return { ok: false, motivo: 'sin_sesion' };
  const control = new AbortController();
  const t = setTimeout(() => control.abort(), 30000);
  try {
    const r = await fetch(URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ llave, titulo, texto }),
      signal: control.signal,
    });
    const d = await r.json().catch(() => null);
    if (r.ok && d?.ok && d.texto) return { ok: true, sugerencia: { titulo: String(d.titulo || titulo), texto: String(d.texto), cambios: String(d.cambios || '') } };
    const e = d?.error;
    return { ok: false, motivo: e === 'sesion_conoxxo' ? 'sin_sesion' : e === 'ia_no_configurada' ? 'no_activa' : e === 'no_habilitado' ? 'no_habilitado' : e === 'limite_diario' ? 'limite' : 'error' };
  } catch {
    return { ok: false, motivo: 'error' };
  } finally {
    clearTimeout(t);
  }
}
