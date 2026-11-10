// worker/faq.js
// Preguntas frecuentes del reglamento (migration 44): POST /api/faq/generar
// { llave, desde }. Called from the Panel Conoxxo (DashboardsOxxo
// conoxxo.html, another origin: see CORS in worker/index.js), a few articles
// per call: the panel walks the whole RIT with `siguiente`.
// Supabase decides who may do it (sesion_reglamento_articulos and
// sesion_faq_proponer check empleado_gestiona_personal with the session), and
// Claude Haiku 5.5 writes 1-3 questions an employee would ask about each
// article, answered only from it. They are saved as 'propuesta' for RH to
// approve, edit or discard; nothing reaches the app before that.
import { clienteClaude, pedirJson } from './claude.js';

const POR_LLAMADA = 6;

const SISTEMA = `Eres Recursos Humanos de OXXO Plaza Oaxaca. Te paso artículos del Reglamento Interior de Trabajo (RIT).
Para cada artículo que le importe a un empleado de tienda, escribe de 1 a 3 preguntas frecuentes como las haría un empleado (lenguaje sencillo, en primera persona: "¿Qué pasa si llego tarde?") y su respuesta.
- La respuesta sale SOLO del artículo: no inventes plazos, montos ni sanciones. Máximo 60 palabras, tuteando, y termina citando "(Art. N)".
- Si un artículo es solo de trámite interno o no le sirve a un empleado, no escribas preguntas para él.
- "articulo" es el número del artículo en el que se basa la respuesta.`;

const ESQUEMA = {
  type: 'object',
  properties: {
    faqs: {
      type: 'array',
      items: {
        type: 'object',
        properties: { articulo: { type: 'integer' }, pregunta: { type: 'string' }, respuesta: { type: 'string' } },
        required: ['articulo', 'pregunta', 'respuesta'],
        additionalProperties: false,
      },
    },
  },
  required: ['faqs'],
  additionalProperties: false,
};

const json = (cuerpo, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

export async function generarFaq(request, env, rpc) {
  const pedido = await request.json().catch(() => null);
  const llave = String((pedido && pedido.llave) || '');
  const desde = Math.max(0, Number(pedido && pedido.desde) || 0);
  if (!/^[0-9a-f]{64}$/.test(llave)) return json({ ok: false, error: 'sesion_conoxxo' }, 401);
  const cliente = clienteClaude(env);
  if (!cliente) return json({ ok: false, error: 'ia_no_configurada' }, 503);

  const r = await rpc(env, 'sesion_reglamento_articulos', { p_token: llave, p_desde: desde, p_limite: POR_LLAMADA });
  if (!r || r.estado === 'no_session') return json({ ok: false, error: 'sesion_conoxxo' }, 401);
  if (r.estado !== 'ok') return json({ ok: false, error: 'no_habilitado' }, 403);
  const articulos = Array.isArray(r.articulos) ? r.articulos : [];
  if (!articulos.length) return json({ ok: true, guardadas: 0, articulos: [], siguiente: null });

  const numeros = new Set(articulos.map((a) => a.number));
  const texto = articulos.map((a) => `[Artículo ${a.number}]\n${String(a.body || '').slice(0, 4000)}`).join('\n\n');
  const inicio = Date.now();
  const { datos, uso, modelo } = await pedirJson(cliente, { system: SISTEMA, usuario: texto, schema: ESQUEMA, maxTokens: 6000 });
  // Only questions about the articles that were sent.
  const items = (Array.isArray(datos.faqs) ? datos.faqs : [])
    .filter((f) => numeros.has(Number(f.articulo)))
    .map((f) => ({ articulo: Number(f.articulo), pregunta: String(f.pregunta || '').trim(), respuesta: String(f.respuesta || '').trim() }))
    .filter((f) => f.pregunta.length >= 5 && f.respuesta.length >= 5);
  const g = items.length ? await rpc(env, 'sesion_faq_proponer', { p_token: llave, p_items: items }) : { estado: 'ok', guardadas: 0 };
  if (!g || g.estado !== 'ok') return json({ ok: false, error: g && g.estado === 'not_allowed' ? 'no_habilitado' : 'no_guardado' }, 403);
  console.log(JSON.stringify({ faq_ia: true, modelo, ms: Date.now() - inicio, articulos: articulos.length, propuestas: items.length, guardadas: g.guardadas, uso }));
  const ultimo = articulos[articulos.length - 1].number;
  return json({
    ok: true,
    guardadas: g.guardadas,
    articulos: articulos.map((a) => a.number),
    siguiente: articulos.length < POR_LLAMADA ? null : ultimo + 1,
  });
}
