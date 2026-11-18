// src/utils/sinConexion.ts
// Copies of the last avisos and the approved preguntas frecuentes, to show
// them when there is no signal (stores with bad internet). They are used ONLY
// when the request failed for lack of connection, never when the server
// answered (an expired session still asks for the PIN). They live under
// storageKeys, so logout erases them with everything else.
import { getJson, setJson } from '../services/appStorage';

// The request never reached the server: offline, DNS, timeout, cut connection.
export function esFalloRed(e: unknown): boolean {
  if (typeof navigator !== 'undefined' && (navigator as any).onLine === false) return true;
  const m = String((e as any)?.message ?? e ?? '');
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed|timed? ?out|aborted|err_internet|err_network/i.test(m);
}

export type Guardado<T> = { guardado: string; datos: T };

export async function guardar<T>(clave: string, datos: T) {
  await setJson(clave, { guardado: new Date().toISOString(), datos } as Guardado<T>).catch(() => {});
}

export async function leerGuardado<T>(clave: string): Promise<Guardado<T> | null> {
  const g = await getJson<Guardado<T> | null>(clave, null).catch(() => null);
  return g && g.guardado && g.datos ? g : null;
}

const fmt = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
// "18 nov., 10:30"
export const cuando = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : fmt.format(d);
};

// Offline search in the saved preguntas frecuentes: words in common, the
// question counting double. Returns the best one, or null if none is close.
const VACIAS = new Set('que los las una unos unas por para con sin mis sus del les como cual cuales cuando donde hay puedo debo tengo pueden puede esta este eso esa'.split(' '));
const palabras = (t: string) =>
  String(t || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9ñ]+/)
    .filter((w) => w.length > 2 && !VACIAS.has(w));

export function buscarFaq<F extends { pregunta: string; respuesta: string }>(lista: F[], pregunta: string): F | null {
  const q = new Set(palabras(pregunta));
  if (!q.size) return null;
  let mejor: F | null = null;
  let puntos = 0;
  for (const f of lista) {
    let p = 0;
    for (const w of new Set(palabras(f.pregunta))) if (q.has(w)) p += 2;
    for (const w of new Set(palabras(f.respuesta))) if (q.has(w)) p += 1;
    if (p > puntos) {
      puntos = p;
      mejor = f;
    }
  }
  return puntos >= 3 ? mejor : null;
}
