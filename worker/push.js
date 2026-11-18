// worker/push.js
// Notifications of new avisos on the phone (web push), with WebCrypto only.
//
// - cifrar(): message encryption of RFC 8291 (aes128gcm, RFC 8188), checked
//   against the RFC's own example in scripts/check-worker.mjs.
// - vapid(): the signed token (RFC 8292) that proves the message comes from
//   this app. The keys are Cloudflare secrets: VAPID_PUBLIC_KEY (uncompressed
//   P-256 point, base64url) and VAPID_PRIVATE_KEY (the private number d,
//   base64url). They are generated in the browser (public/llaves-avisos.html)
//   and never pass through the code or the chat. Without them, everything here
//   answers 'push_no_configurado' and the app hides the button.
// - Endpoints and keys of the phones are never logged.
//
// Routes (worker/index.js):
//   GET  /api/push/clave            -> { ok, clave } (public key, for subscribe)
//   POST /api/push/enviar { llave } -> sends the next batch (max 40) of the
//        newest aviso; only who may publish avisos (sesion_push_lote).
//   POST /api/push/probar { llave } -> sends a test to the caller's own phones.

const SUB = 'https://conoxxo.plaza-oaxaca.workers.dev';
const TTL = 86400; // a day: a phone that is off gets it when it comes back
const json = (cuerpo, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

const enc = new TextEncoder();

export function b64u(bytes) {
  let s = '';
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function deB64u(texto) {
  const s = String(texto || '').replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, '');
  const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
const unir = (...partes) => {
  const out = new Uint8Array(partes.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of partes) {
    out.set(p, i);
    i += p.length;
  }
  return out;
};

async function hmac(clave, datos) {
  const k = await crypto.subtle.importKey('raw', clave, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, datos));
}
// HKDF with a single output block (every length used here is <= 32).
async function hkdf(salt, ikm, info, largo) {
  const prk = await hmac(salt, ikm);
  return (await hmac(prk, unir(info, new Uint8Array([1])))).slice(0, largo);
}

// JWK of a P-256 key from its uncompressed public point (and d, if private).
function jwk(publica, d) {
  const p = publica instanceof Uint8Array ? publica : deB64u(publica);
  if (p.length !== 65 || p[0] !== 4) throw new Error('clave_publica_invalida');
  const k = { kty: 'EC', crv: 'P-256', x: b64u(p.slice(1, 33)), y: b64u(p.slice(33, 65)), ext: true };
  if (d) k.d = typeof d === 'string' ? d : b64u(d);
  return k;
}

// RFC 8291. fijo (tests only): { asPublica, asPrivada, salt } to reproduce the RFC example.
export async function cifrar(uaPublicaB64, authB64, contenido, fijo = null) {
  const uaPublica = deB64u(uaPublicaB64);
  const auth = deB64u(authB64);
  let asPublica;
  let asPrivada;
  if (fijo) {
    asPublica = deB64u(fijo.asPublica);
    asPrivada = await crypto.subtle.importKey('jwk', jwk(asPublica, fijo.asPrivada), { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
  } else {
    const par = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    asPrivada = par.privateKey;
    asPublica = new Uint8Array(await crypto.subtle.exportKey('raw', par.publicKey));
  }
  const salt = fijo ? deB64u(fijo.salt) : crypto.getRandomValues(new Uint8Array(16));
  const uaClave = await crypto.subtle.importKey('raw', uaPublica, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaClave }, asPrivada, 256));

  const keyInfo = unir(enc.encode('WebPush: info\0'), uaPublica, asPublica);
  const ikm = await hkdf(auth, ecdh, keyInfo, 32);
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);

  const datos = typeof contenido === 'string' ? enc.encode(contenido) : contenido;
  const clave = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, clave, unir(datos, new Uint8Array([2]))));

  const rs = new Uint8Array([0, 0, 16, 0]); // record size 4096
  return unir(salt, rs, new Uint8Array([asPublica.length]), asPublica, cifrado);
}

// RFC 8292: "vapid t=<JWT>, k=<public key>" for the push service of `endpoint`.
export async function vapid(env, endpoint) {
  const publica = String(env.VAPID_PUBLIC_KEY || '').trim();
  const privada = String(env.VAPID_PRIVATE_KEY || '').trim();
  const clave = await crypto.subtle.importKey('jwk', jwk(publica, privada), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const cab = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const cuerpo = b64u(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: SUB })));
  const firma = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, clave, enc.encode(`${cab}.${cuerpo}`));
  return `vapid t=${cab}.${cuerpo}.${b64u(firma)}, k=${publica}`;
}

const configurado = (env) => !!(String(env.VAPID_PUBLIC_KEY || '').trim() && String(env.VAPID_PRIVATE_KEY || '').trim());

// One message to one phone. Returns 'ok' | 'vencida' (404/410: forget it) | 'error'.
async function enviarUno(env, destino, mensaje, urgente) {
  try {
    const cuerpo = await cifrar(destino.p256dh, destino.auth, JSON.stringify(mensaje));
    const r = await fetch(destino.endpoint, {
      method: 'POST',
      headers: {
        Authorization: await vapid(env, destino.endpoint),
        TTL: String(TTL),
        Urgency: urgente ? 'high' : 'normal',
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
      },
      body: cuerpo,
    });
    if (r.status === 404 || r.status === 410) return 'vencida';
    return r.ok ? 'ok' : 'error';
  } catch {
    return 'error';
  }
}

async function enviarTodos(env, rpc, llave, destinos, mensaje, urgente) {
  const resultados = await Promise.all(destinos.map((d) => enviarUno(env, d, mensaje, urgente)));
  const vencidas = destinos.filter((_, i) => resultados[i] === 'vencida').map((d) => d.endpoint);
  if (vencidas.length) await rpc(env, 'sesion_push_vencidas', { p_token: llave, p_endpoints: vencidas }).catch(() => null);
  return {
    enviados: resultados.filter((x) => x === 'ok').length,
    vencidas: vencidas.length,
    errores: resultados.filter((x) => x === 'error').length,
  };
}

// Per-isolate limit for the test button (approximate, it only avoids spam).
const pruebas = new Map();
function contarPrueba(llave) {
  const ahora = Date.now();
  const lista = (pruebas.get(llave) || []).filter((t) => ahora - t < 3600 * 1000);
  if (lista.length >= 5) return false;
  lista.push(ahora);
  pruebas.set(llave, lista);
  return true;
}

export async function push(request, env, rpc, ruta) {
  if (ruta === 'clave') {
    if (request.method !== 'GET') return new Response('Método no permitido', { status: 405 });
    if (!configurado(env)) return json({ ok: false, error: 'push_no_configurado' }, 503);
    return json({ ok: true, clave: String(env.VAPID_PUBLIC_KEY).trim() });
  }
  if (request.method !== 'POST') return new Response('Método no permitido', { status: 405 });
  const pedido = await request.json().catch(() => null);
  const llave = String((pedido && pedido.llave) || '');
  if (!/^[0-9a-f]{64}$/.test(llave)) return json({ ok: false, error: 'sesion_conoxxo' }, 401);
  if (!configurado(env)) return json({ ok: false, error: 'push_no_configurado' }, 503);

  if (ruta === 'enviar') {
    const lote = await rpc(env, 'sesion_push_lote', { p_token: llave, p_limite: 40 });
    if (!lote || lote.estado === 'no_session') return json({ ok: false, error: 'sesion_conoxxo' }, 401);
    if (lote.estado === 'not_allowed') return json({ ok: false, error: 'no_habilitado' }, 403);
    if (lote.estado === 'sin_aviso') return json({ ok: true, enviados: 0, quedan: 0 });
    if (lote.estado !== 'ok') return json({ ok: false, error: 'sin_lote' }, 502);
    const aviso = lote.aviso || {};
    const mensaje = { titulo: aviso.priority ? 'Aviso importante de RH' : 'Nuevo aviso de RH', texto: String(aviso.title || '').slice(0, 120), url: '/?ir=avisos', etiqueta: `aviso-${aviso.id}` };
    const r = await enviarTodos(env, rpc, llave, Array.isArray(lote.destinos) ? lote.destinos : [], mensaje, !!aviso.priority);
    console.log(JSON.stringify({ push: 'enviar', ...r, quedan: lote.quedan }));
    return json({ ok: true, ...r, quedan: Number(lote.quedan) || 0 });
  }

  if (ruta === 'probar') {
    if (!contarPrueba(llave)) return json({ ok: false, error: 'limite_diario' }, 429);
    const mios = await rpc(env, 'sesion_push_mios', { p_token: llave });
    if (!mios || mios.estado !== 'ok') return json({ ok: false, error: 'sesion_conoxxo' }, 401);
    const destinos = Array.isArray(mios.destinos) ? mios.destinos : [];
    if (!destinos.length) return json({ ok: false, error: 'sin_celulares' }, 404);
    const mensaje = { titulo: 'Prueba de Conoxxo', texto: 'Así te llegarán los avisos nuevos de RH.', url: '/?ir=avisos', etiqueta: 'prueba' };
    const r = await enviarTodos(env, rpc, llave, destinos, mensaje, false);
    console.log(JSON.stringify({ push: 'probar', ...r }));
    return json({ ok: true, ...r });
  }
  return json({ ok: false, error: 'no_encontrado' }, 404);
}
