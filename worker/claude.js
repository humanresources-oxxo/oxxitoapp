// worker/claude.js
// Claude Haiku 5.5 for the Worker's AI features (chat, Mejorar redacción). The
// API key lives only in the Cloudflare secret ANTHROPIC_API_KEY (Workers ->
// conoxxo -> Settings -> Variables and Secrets); without it every feature
// keeps working the way it did before (Workers AI or no AI).
//
// Every call asks for JSON with a fixed schema (structured outputs), so the
// Worker never has to guess where the answer starts or which article it used.
import Anthropic from '@anthropic-ai/sdk';

export const MODELO_HAIKU = 'claude-haiku-5-5';

export function clienteClaude(env) {
  const apiKey = String(env.ANTHROPIC_API_KEY || '').trim();
  if (!apiKey) return null;
  // Short tasks: fail fast and let the caller fall back.
  return new Anthropic({ apiKey, maxRetries: 1, timeout: 20000 });
}

export class SinRespuesta extends Error {}

// One request that must return JSON matching `schema`. Low effort: these are
// short, well-specified tasks.
export async function pedirJson(cliente, { system, usuario, schema, maxTokens = 2048, effort = 'low', modelo = MODELO_HAIKU }) {
  const r = await cliente.messages.create({
    model: modelo,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: usuario }],
    output_config: { effort, format: { type: 'json_schema', schema } },
  });
  // A safety decline or a cut-off answer is not usable: the caller falls back.
  if (r.stop_reason === 'refusal') throw new SinRespuesta('refusal');
  if (r.stop_reason === 'max_tokens') throw new SinRespuesta('max_tokens');
  const texto = r.content.find((b) => b.type === 'text');
  if (!texto) throw new SinRespuesta('sin_texto');
  return { datos: JSON.parse(texto.text), uso: r.usage, modelo: r.model };
}
