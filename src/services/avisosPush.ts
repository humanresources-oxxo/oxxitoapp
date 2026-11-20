// src/services/avisosPush.ts
// Notifications of new avisos on the phone (web push; migration 58 and
// worker/push.js). Web only: the app is used as a web app (installed from the
// browser). On iPhone it works only when the app is installed on the home
// screen (Safari, iOS 16.4 or newer).
//
// - activar(): asks for permission (call it only from a tap), subscribes with
//   the Worker's public key and saves the subscription with the session key.
// - desactivar(): unsubscribes this phone and deletes it on the server (also
//   on logout, so a shared store phone stops receiving avisos).
// - enviarATodos(): after publishing an aviso, sends it in batches of 40.
import { Platform } from 'react-native';
import { getJson, setJson, storageKeys } from './appStorage';
import { leerLlave } from './sesion';
import { supabase } from './supabaseClient';

const BASE = Platform.OS === 'web' ? '' : 'https://conoxxo.plaza-oaxaca.workers.dev';

export type EstadoPush =
  | 'no_disponible' // not web, or the browser has no push
  | 'instalar_iphone' // iPhone in Safari without installing the app
  | 'no_configurado' // the Worker has no keys yet
  | 'bloqueado' // the person denied the permission
  | 'apagado'
  | 'activo';

const w: any = typeof window !== 'undefined' ? window : undefined;

const esIphone = () => !!w && /iPhone|iPad|iPod/.test(w.navigator?.userAgent || '');
const instalada = () => !!w && (w.matchMedia?.('(display-mode: standalone)').matches || w.navigator?.standalone === true);
const conPush = () => !!w && 'serviceWorker' in w.navigator && 'PushManager' in w && 'Notification' in w;

function aBytes(b64u: string) {
  const s = b64u.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
function aB64u(buf: ArrayBuffer | null) {
  if (!buf) return '';
  let s = '';
  new Uint8Array(buf).forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function claveServidor(): Promise<string | null> {
  try {
    const r = await fetch(`${BASE}/api/push/clave`);
    const d = await r.json().catch(() => null);
    return r.ok && d?.ok && d.clave ? String(d.clave) : null;
  } catch {
    return null;
  }
}

// The service worker (public/sw.js) only shows notifications; registering it
// is cheap and lets an existing subscription keep working after updates.
export async function registrar() {
  if (Platform.OS !== 'web' || !conPush()) return null;
  try {
    return await w.navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch {
    return null;
  }
}

export async function estado(): Promise<EstadoPush> {
  if (Platform.OS !== 'web' || !w) return 'no_disponible';
  if (esIphone() && !instalada()) return 'instalar_iphone';
  if (!conPush()) return 'no_disponible';
  const clave = await claveServidor();
  if (!clave) return 'no_configurado';
  if (w.Notification.permission === 'denied') return 'bloqueado';
  const reg = await registrar();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (!sub) return 'apagado';
  // The server's key changed (new keys in Cloudflare): subscribe again.
  const guardada = await getJson<string | null>(storageKeys.pushClave, null);
  if (guardada !== clave) {
    const r = await activar().catch(() => 'error');
    return r === 'ok' ? 'activo' : 'apagado';
  }
  return 'activo';
}

// 'ok' | 'bloqueado' | 'no_configurado' | 'no_session' | 'error'
export async function activar(): Promise<string> {
  if (!conPush()) return 'error';
  const clave = await claveServidor();
  if (!clave) return 'no_configurado';
  const permiso = await w.Notification.requestPermission();
  if (permiso !== 'granted') return 'bloqueado';
  const reg = await registrar();
  if (!reg) return 'error';
  await w.navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  const guardada = await getJson<string | null>(storageKeys.pushClave, null);
  if (sub && guardada !== clave) {
    await sub.unsubscribe().catch(() => {});
    sub = null;
  }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(clave) });
  const llave = await leerLlave();
  if (!llave) return 'no_session';
  const { data, error } = await supabase.rpc('sesion_push_guardar', {
    p_token: llave,
    p_endpoint: sub.endpoint,
    p_p256dh: aB64u(sub.getKey('p256dh')),
    p_auth: aB64u(sub.getKey('auth')),
  });
  if (error || data !== 'ok') return data === 'no_session' ? 'no_session' : 'error';
  await setJson(storageKeys.pushClave, clave);
  return 'ok';
}

export async function desactivar(llave?: string | null) {
  if (Platform.OS !== 'web' || !conPush()) return;
  try {
    const reg = await w.navigator.serviceWorker.getRegistration('/');
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    if (!sub) return;
    const k = llave ?? (await leerLlave());
    if (k) await supabase.rpc('sesion_push_borrar', { p_token: k, p_endpoint: sub.endpoint });
    await sub.unsubscribe();
  } catch {
    // Best effort: the server forgets it when the push service says it is gone.
  }
}

// { ok, enviados } | { ok: false, error }
export async function probar(): Promise<{ ok: boolean; enviados?: number; error?: string }> {
  const llave = await leerLlave();
  if (!llave) return { ok: false, error: 'sesion_conoxxo' };
  try {
    const r = await fetch(`${BASE}/api/push/probar`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ llave }) });
    const d = await r.json().catch(() => null);
    if (d?.ok && !d.enviados) return { ok: false, error: (d.codigos || []).includes('403') ? 'llaves' : 'no_entregado' };
    return d?.ok ? { ok: true, enviados: d.enviados } : { ok: false, error: d?.error || 'error' };
  } catch {
    return { ok: false, error: 'sin_conexion' };
  }
}

// After publishing an aviso (or creating a votación, tipo 'votacion'): batches
// until none are left (max 50 rounds). Returns how many phones got it, or null
// if notifications are not set up.
export async function enviarATodos(tipo: 'aviso' | 'votacion' = 'aviso'): Promise<number | null> {
  const llave = await leerLlave();
  if (!llave) return null;
  let total = 0;
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(`${BASE}/api/push/enviar`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ llave, tipo }) });
      const d = await r.json().catch(() => null);
      if (!d?.ok) return i === 0 && d?.error === 'push_no_configurado' ? null : total;
      total += Number(d.enviados) || 0;
      if (!d.quedan) return total;
    } catch {
      return total;
    }
  }
  return total;
}
