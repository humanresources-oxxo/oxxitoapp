// worker/datos.js
// "Pregúntale a la ficha": a chatbot about the Ficha de Plaza numbers, for
// office puestos. POST /api/datos-chat { llave, pregunta, datos, historial }.
//
// - The Ficha (DashboardsOxxo js/ficha-plaza.js datosChat) sends the numbers it
//   already shows, aggregated: totals, one row per asesor and the 5 plazas.
//   Never colaborador rows or names. Claude Haiku answers only from them.
// - Who: a valid Conoxxo session whose puesto is NOT a store puesto (Líder,
//   Encargado, Ayudante, satélite included); an empty puesto is refused. On
//   top of that, DATOS_IA_NUMEROS limits it to a list of employee numbers
//   ("*" = everyone who passes the puesto check) until RH approves opening it.
// - { llave, verificar: true } only answers whether this session may use it
//   (the Ficha shows the chat card only then); it does not call Haiku.
// - The question text is never logged: only model, time and token counts.
import { clienteClaude, pedirJson } from './claude.js';
import { contarUso } from './limite.js';

const MAX_DATOS = 20000; // characters of JSON
const MAX_PREGUNTA = 400;
const MAX_TURNOS = 4; // previous question/answer pairs sent back as context
const LIMITE_DIA = 30;

const SISTEMA = `Eres analista de Recursos Humanos de OXXO Plaza Oaxaca. Contestas preguntas de personal de oficina sobre la Ficha de Plaza. Recibes en JSON los indicadores del último corte: aprovechamiento de estructura, vacantes, bajas del mes contra su compromiso, una fila por asesor y el comparativo de las 5 plazas de la región.
Reglas:
- Usa SOLO los números del JSON. Si la respuesta no está ahí (por ejemplo nombres de colaboradores, causas de baja, rotación, tiempo extra u otros dashboards), dilo en una frase y sugiere revisar el dashboard correspondiente o preguntar a RH. No inventes cifras, causas ni tendencias.
- Puedes sumar, restar, comparar y ordenar con los números que recibes; di la cifra concreta y el asesor, tienda o plaza cuando aplique.
- Responde en español de México, directo, sin emojis, en máximo 90 palabras. Para listas usa líneas que empiecen con "- ".
Glosario: "aprovechamiento" = % de tiendas con el equipo completo (completas, incompletas y críticas suman las tiendas); "compromiso" = bajas que se esperaban en el mes; "desfase" = bajas menos compromiso (positivo es malo, negativo es bueno); "vacantesDeMasDe6Dias" = vacantes abiertas hace más de 6 días; "masAntigua" = la vacante con más días abierta; "sinAsesorConfirmado" = bajas del mes que no tienen asesor asignado.`;

const ESQUEMA = {
  type: 'object',
  properties: { respuesta: { type: 'string' } },
  required: ['respuesta'],
  additionalProperties: false,
};

const json = (cuerpo, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

// Same normalization as puesto_con_permisos in Supabase.
const normalizar = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
const PUESTOS_TIENDA = ['LIDER TIENDA', 'ENCARGADO TURNO', 'AYUDANTE TIENDA'];
export function esPuestoOficina(puesto) {
  const p = normalizar(puesto);
  return !!p && !PUESTOS_TIENDA.some((t) => p.startsWith(t));
}

export function habilitadosDatos(env) {
  return String(env.DATOS_IA_NUMEROS || '')
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function limpiarHistorial(h) {
  if (!Array.isArray(h)) return [];
  return h
    .slice(-MAX_TURNOS)
    .map((t) => ({
      pregunta: String((t && t.pregunta) || '').replace(/\s+/g, ' ').trim().slice(0, MAX_PREGUNTA),
      respuesta: String((t && t.respuesta) || '').trim().slice(0, 800),
    }))
    .filter((t) => t.pregunta && t.respuesta);
}

export async function datosChat(request, env, rpc) {
  const pedido = await request.json().catch(() => null);
  const llave = String((pedido && pedido.llave) || '');
  if (!/^[0-9a-f]{64}$/.test(llave)) return json({ ok: false, error: 'sesion_conoxxo' }, 401);

  const verificar = !!(pedido && pedido.verificar);
  const pregunta = String((pedido && pedido.pregunta) || '').replace(/\s+/g, ' ').trim();
  const datos = pedido && pedido.datos;
  const texto = JSON.stringify(datos || null);
  if (!verificar) {
    if (pregunta.length < 3 || pregunta.length > MAX_PREGUNTA) return json({ ok: false, error: 'pregunta_invalida' }, 400);
    if (!datos || typeof datos !== 'object' || texto.length > MAX_DATOS) return json({ ok: false, error: 'datos_invalidos' }, 400);
  }

  const sesion = await rpc(env, 'sesion_validar', { p_token: llave });
  if (!sesion || sesion.estado !== 'ok') return json({ ok: false, error: 'sesion_conoxxo' }, 401);
  const numero = String(sesion.numero || '');
  if (!esPuestoOficina(sesion.puesto)) return json({ ok: false, error: 'no_habilitado' }, 403);
  const lista = habilitadosDatos(env);
  if (!lista.includes('*') && !lista.includes(numero)) return json({ ok: false, error: 'no_habilitado' }, 403);
  const cliente = clienteClaude(env);
  if (!cliente) return json({ ok: false, error: 'ia_no_configurada' }, 503);
  if (verificar) return json({ ok: true });

  if (!(await contarUso(env, rpc, llave, 'datos', Number(env.DATOS_IA_LIMITE_DIA) || LIMITE_DIA, numero))) return json({ ok: false, error: 'limite_diario' }, 429);

  const historial = limpiarHistorial(pedido.historial);
  const usuario = [
    `Datos de la ficha (JSON):\n${texto}`,
    historial.length ? `Conversación anterior:\n${historial.map((t) => `P: ${t.pregunta}\nR: ${t.respuesta}`).join('\n')}` : '',
    `Pregunta: ${pregunta}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  const inicio = Date.now();
  const { datos: r, uso, modelo } = await pedirJson(cliente, { system: SISTEMA, usuario, schema: ESQUEMA, maxTokens: 1024 });
  const respuesta = String((r && r.respuesta) || '').trim().slice(0, 1500);
  if (!respuesta) return json({ ok: false, error: 'sin_respuesta' }, 502);
  console.log(JSON.stringify({ datos_ia: true, modelo, ms: Date.now() - inicio, turnos: historial.length, uso }));
  return json({ ok: true, respuesta });
}
