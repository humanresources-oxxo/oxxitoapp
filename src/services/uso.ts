// src/services/uso.ts
// How the app is used, without knowing who (migration 59):
// - registrarUso(): one count per screen and day per phone. The server keeps
//   a hash with a salt of that day only, so it can count people but not tell
//   who they are.
// - votarRespuesta(): "¿Te sirvió?" of the chat. Only the article, whether the
//   AI wrote it and the vote; never the question.
// Everything here is best effort: it never shows an error nor asks for the PIN.
import { getJson, setJson, storageKeys } from './appStorage';
import { rpcSesion } from './sesion';

const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });

export async function registrarUso(apartado: string) {
  try {
    const dia = hoy();
    const g = await getJson<{ dia: string; vistos: string[] } | null>(storageKeys.usoHoy, null);
    const vistos = g && g.dia === dia ? g.vistos : [];
    if (vistos.includes(apartado)) return;
    const r = await rpcSesion<string>('sesion_uso_registrar', { p_apartado: apartado }, false);
    if (r === 'ok' || r === 'invalid') await setJson(storageKeys.usoHoy, { dia, vistos: [...vistos, apartado] });
  } catch {
    // Next time.
  }
}

// 'ok' | 'limite' | 'error'
export async function votarRespuesta(articulo: number | undefined, ia: boolean, voto: 1 | -1): Promise<string> {
  try {
    const r = await rpcSesion<string>('sesion_chat_votar', { p_articulo: articulo ?? null, p_ia: ia, p_voto: voto }, false);
    return r === 'ok' || r === 'limite' ? r : 'error';
  } catch {
    return 'error';
  }
}
