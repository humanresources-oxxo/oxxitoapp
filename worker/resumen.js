// worker/resumen.js
// "Lo importante" of the Ficha de Plaza (Resumen tab): POST /api/resumen-ficha
// { llave, datos }. The Ficha (DashboardsOxxo js/ficha-plaza.js datosResumen)
// sends the numbers it already shows; Claude Haiku 5.5 turns them into a
// headline and 2-4 points, using only those numbers. Only for puestos with
// permisos or "ficha" (migration 57: the ones that see the Ficha). Same numbers -> same summary: it is
// kept in memory here and in the phone, so it is paid once per cut.
import { clienteClaude, pedirJson } from './claude.js';
import { contarUso } from './limite.js';

const MAX_DATOS = 12000; // characters of JSON
const LIMITE_DIA = 20;

const SISTEMA = `Eres analista de Recursos Humanos de OXXO. Recibes en JSON los indicadores del último corte de una plaza (aprovechamiento de estructura, vacantes, bajas contra su compromiso del mes, los asesores con menor aprovechamiento y el comparativo con las otras plazas de la región).
Escribe para el gerente de plaza y RH lo más importante de esos números:
- "titular": una frase de máximo 90 caracteres con lo principal.
- "puntos": de 2 a 4 puntos, cada uno de máximo 25 palabras, con cifras concretas y, cuando aplique, el nombre del asesor o la tienda.
Usa SOLO los datos que recibes: no inventes causas, tendencias ni cifras que no estén. Si algo va bien, dilo también. Español de México, directo, sin emojis.
Glosario: "aprovechamiento" = % de tiendas con el equipo completo; "desfase" de bajas positivo = más bajas que el compromiso (malo), negativo = menos (bueno); "más antigua" = la vacante con más días abierta.`;

const ESQUEMA = {
  type: 'object',
  properties: { titular: { type: 'string' }, puntos: { type: 'array', items: { type: 'string' } } },
  required: ['titular', 'puntos'],
  additionalProperties: false,
};

const json = (cuerpo, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

async function huella(texto) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Per-isolate memory: same numbers, same summary (6 h).
const guardados = new Map();

export async function resumenFicha(request, env, rpc) {
  const pedido = await request.json().catch(() => null);
  const llave = String((pedido && pedido.llave) || '');
  const datos = pedido && pedido.datos;
  if (!/^[0-9a-f]{64}$/.test(llave)) return json({ ok: false, error: 'sesion_conoxxo' }, 401);
  const texto = JSON.stringify(datos || null);
  if (!datos || typeof datos !== 'object' || texto.length > MAX_DATOS) return json({ ok: false, error: 'datos_invalidos' }, 400);

  const sesion = await rpc(env, 'sesion_validar', { p_token: llave });
  if (!sesion || sesion.estado !== 'ok') return json({ ok: false, error: 'sesion_conoxxo' }, 401);
  if (!sesion.permisos && !sesion.ficha) return json({ ok: false, error: 'no_habilitado' }, 403);
  const cliente = clienteClaude(env);
  if (!cliente) return json({ ok: false, error: 'ia_no_configurada' }, 503);

  const clave = await huella(texto);
  const previo = guardados.get(clave);
  if (previo && previo.vence > Date.now()) return json({ ok: true, ...previo.resumen, guardado: true });
  if (!(await contarUso(env, rpc, llave, 'resumen', LIMITE_DIA, String(sesion.numero || '')))) return json({ ok: false, error: 'limite_diario' }, 429);

  const inicio = Date.now();
  const { datos: r, uso, modelo } = await pedirJson(cliente, { system: SISTEMA, usuario: texto, schema: ESQUEMA, maxTokens: 2048 });
  const resumen = {
    titular: String(r.titular || '').trim().slice(0, 140),
    puntos: (Array.isArray(r.puntos) ? r.puntos : []).map((p) => String(p || '').trim()).filter(Boolean).slice(0, 4),
  };
  if (!resumen.titular && !resumen.puntos.length) return json({ ok: false, error: 'sin_respuesta' }, 502);
  guardados.set(clave, { resumen, vence: Date.now() + 6 * 3600 * 1000 });
  console.log(JSON.stringify({ resumen_ia: true, modelo, ms: Date.now() - inicio, uso }));
  return json({ ok: true, ...resumen });
}
