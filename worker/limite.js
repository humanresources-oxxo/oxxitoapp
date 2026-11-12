// worker/limite.js
// Daily limit per employee for the AI features (chat, redactar, resumen).
// It is counted in Supabase (sesion_ia_contar, migration 51), so it holds
// across every copy of the Worker and across restarts. If Supabase cannot
// count (migration 51 not run yet, or it is down), the old count in this
// isolate's memory is used instead: approximate, but never unlimited.
const usos = new Map();
function contarEnMemoria(clave, limite) {
  const dia = new Date().toISOString().slice(0, 10);
  const u = usos.get(clave);
  const n = u && u.dia === dia ? u.n : 0;
  if (n >= limite) return false;
  usos.set(clave, { dia, n: n + 1 });
  return true;
}

// true: counted, go ahead. false: the limit for today was reached.
// funcion: 'chat' | 'redactar' | 'resumen'. clave: who, for the memory count.
export async function contarUso(env, rpc, llave, funcion, limite, clave) {
  try {
    const r = await rpc(env, 'sesion_ia_contar', { p_token: llave, p_funcion: funcion, p_limite: limite });
    if (r && r.estado === 'ok') return true;
    if (r && (r.estado === 'limite' || r.estado === 'no_session')) return false;
  } catch (err) {
    console.log(JSON.stringify({ limite_ia: true, funcion, error: String((err && err.message) || err) }));
  }
  return contarEnMemoria(`${funcion}:${clave}`, limite);
}
