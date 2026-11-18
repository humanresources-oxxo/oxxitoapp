// scripts/check-push.mjs
// worker/push.js against the worked example of RFC 8291 (section 5 and
// appendix A): fixed keys and salt must give exactly the RFC's message. Also
// decrypts a random message the way a phone would. Used by revisar.yml.
import { webcrypto } from 'node:crypto';
import { cifrar, deB64u, b64u, vapid } from '../worker/push.js';

if (!globalThis.crypto) globalThis.crypto = webcrypto;
const fallas = [];
const igual = (nombre, a, b) => { if (a !== b) fallas.push(`${nombre}:\n  esperado ${b}\n  obtenido ${a}`); };

// RFC 8291, section 5.
const RFC = {
  texto: 'When I grow up, I want to be a watermelon',
  auth: 'BTBZMqHH6r4Tts7J_aSIgg',
  uaPublica: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
  uaPrivada: 'q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94',
  asPublica: 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
  asPrivada: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
  salt: 'DGv6ra1nlYgDCS1FRnbzlw',
  mensaje: 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
};
const salida = await cifrar(RFC.uaPublica, RFC.auth, RFC.texto, { asPublica: RFC.asPublica, asPrivada: RFC.asPrivada, salt: RFC.salt });
igual('RFC 8291 ejemplo', b64u(salida), RFC.mensaje);

// A phone's decryption (RFC 8291 from the receiver side) of a random message.
const s = webcrypto.subtle;
const enc = new TextEncoder();
async function hmac(k, d) { return new Uint8Array(await s.sign('HMAC', await s.importKey('raw', k, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), d)); }
async function hkdf(salt, ikm, info, n) { return (await hmac(await hmac(salt, ikm), new Uint8Array([...info, 1]))).slice(0, n); }
const par = await s.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
const uaPub = new Uint8Array(await s.exportKey('raw', par.publicKey));
const auth = webcrypto.getRandomValues(new Uint8Array(16));
const texto = JSON.stringify({ titulo: 'Nuevo aviso de RH', texto: 'Cambio de horario en tiendas ñ á' });
const m = await cifrar(b64u(uaPub), b64u(auth), texto);
const salt = m.slice(0, 16), idlen = m[20], asPub = m.slice(21, 21 + idlen), cifrado = m.slice(21 + idlen);
const ecdh = new Uint8Array(await s.deriveBits({ name: 'ECDH', public: await s.importKey('raw', asPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []) }, par.privateKey, 256));
const ikm = await hkdf(auth, ecdh, new Uint8Array([...enc.encode('WebPush: info\0'), ...uaPub, ...asPub]), 32);
const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
const plano = new Uint8Array(await s.decrypt({ name: 'AES-GCM', iv: nonce }, await s.importKey('raw', cek, { name: 'AES-GCM' }, false, ['decrypt']), cifrado));
igual('delimitador', plano[plano.length - 1], 2);
igual('ida y vuelta', new TextDecoder().decode(plano.slice(0, -1)), texto);
igual('base64url', b64u(deB64u(RFC.salt)), RFC.salt);

// VAPID (RFC 8292): a JWT signed with the private key that the public key verifies.
const vk = await s.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const env = { VAPID_PUBLIC_KEY: b64u(await s.exportKey('raw', vk.publicKey)), VAPID_PRIVATE_KEY: (await s.exportKey('jwk', vk.privateKey)).d };
const cabecera = await vapid(env, 'https://fcm.googleapis.com/fcm/send/abc');
const [, jwt, k] = cabecera.match(/^vapid t=([^,]+), k=(.+)$/) || [];
const [h, c, f] = String(jwt).split('.');
const claims = JSON.parse(new TextDecoder().decode(deB64u(c)));
igual('vapid k', k, env.VAPID_PUBLIC_KEY);
igual('vapid aud', claims.aud, 'https://fcm.googleapis.com');
igual('vapid sub sin correo', /^https:/.test(claims.sub), true);
igual('vapid exp <= 24 h', claims.exp - Date.now() / 1000 <= 24 * 3600, true);
igual('vapid firma', await s.verify({ name: 'ECDSA', hash: 'SHA-256' }, vk.publicKey, deB64u(f), enc.encode(`${h}.${c}`)), true);

console.log(fallas.length ? `push: ${fallas.length} fallas\n${fallas.join('\n')}` : 'push: cifrado igual al ejemplo del RFC 8291, descifrable y firma VAPID valida');
process.exit(fallas.length ? 1 : 0);
