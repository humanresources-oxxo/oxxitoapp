// src/services/chatQa.ts
// Real-reglamento QA: full-text search over the RIT articles table (Supabase).
// Prototype (answerQuestion): for the employee numbers enabled on the server,
// a Workers AI model writes the answer from the articles that search finds
// (worker/chat.js, POST /api/chat); otherwise, or if it fails, the search.
import { Platform } from 'react-native';
import { leerLlave } from './sesion';
import { supabase } from './supabaseClient';

export type ChatSource = {
  article: string;
  title: string;
  summary: string;
  nextStep: string;
  contact?: {
    name: string;
    area: string;
  };
};

export type ChatChoice = { id: number; label: string };
export type ChoiceKind = 'sancion' | 'item';

export type ChatMessage = {
  id: string;
  role: 'assistant' | 'user';
  text: string;
  citation?: string;
  title?: string;
  source?: ChatSource;
  choices?: ChatChoice[];
  choiceKind?: ChoiceKind;
  ia?: boolean; // written by the AI prototype
};

export type QAResult = {
  answer: string;
  article: string;
  title: string;
  summary: string;
  nextStep: string;
  contact?: { name: string; area: string };
  choices?: ChatChoice[];
  choiceKind?: ChoiceKind;
  ia?: boolean;
  articuloNumero?: number; // article the AI answer is based on
};

const HR_CONTACT = { name: 'Recursos Humanos', area: 'Personas' };

const FALLBACK: QAResult = {
  answer:
    'No encontré un artículo del reglamento que coincida con tu pregunta. Puedes reformularla o contactar a Recursos Humanos para validar el caso.',
  article: 'Soporte',
  title: 'Derivación sugerida',
  summary: 'Cuando no hay coincidencia exacta en el reglamento, conviene validar el caso con el área responsable.',
  nextStep: 'Reformula la pregunta con otra palabra clave o contacta al área correspondiente.',
  contact: HR_CONTACT,
};

function truncate(text: string, max = 220) {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}…`;
}

// The interactive list of an article, if it has one: the sanciones table
// (79, 93, 106) or the numbered items (77, 78).
async function opcionesDe(numero: number): Promise<{ choices: ChatChoice[]; choiceKind: ChoiceKind } | null> {
  if (numero === 79 || numero === 93 || numero === 106) {
    const { data } = await supabase.rpc('list_sanciones', { p_article: numero });
    if (data && data.length > 0) return { choices: (data as { id: number; infraccion: string }[]).map((s) => ({ id: s.id, label: s.infraccion })), choiceKind: 'sancion' };
  }
  if (numero === 77 || numero === 78) {
    const { data } = await supabase.rpc('list_reglamento_items', { p_article: numero });
    if (data && data.length > 0) return { choices: data as ChatChoice[], choiceKind: 'item' };
  }
  return null;
}

export async function matchQA(question: string): Promise<QAResult> {
  const { data, error } = await supabase.rpc('search_reglamento', { q: question });
  if (error || !data || data.length === 0) return FALLBACK;

  const top = data[0] as { article: string; number: number; body: string };

  if (top.number === 79 || top.number === 93 || top.number === 106) {
    const { data: sanciones } = await supabase.rpc('list_sanciones', { p_article: top.number });
    if (sanciones && sanciones.length > 0) {
      return {
        answer: 'Estas son las sanciones del reglamento. Elige el motivo que te interesa para ver el detalle:',
        article: top.article,
        title: `Artículo ${top.number}`,
        summary: top.body,
        nextStep: 'Si necesitas más detalle, contacta a Recursos Humanos o a tu líder directo.',
        contact: HR_CONTACT,
        choices: (sanciones as { id: number; infraccion: string }[]).map((s) => ({ id: s.id, label: s.infraccion })),
        choiceKind: 'sancion',
      };
    }
  }

  if (top.number === 77 || top.number === 78) {
    const { data: items } = await supabase.rpc('list_reglamento_items', { p_article: top.number });
    if (items && items.length > 0) {
      return {
        answer: 'Este artículo tiene varios puntos. Elige el que te interesa para ver el detalle:',
        article: top.article,
        title: `Artículo ${top.number}`,
        summary: top.body,
        nextStep: 'Si necesitas más detalle, contacta a Recursos Humanos o a tu líder directo.',
        contact: HR_CONTACT,
        choices: items as ChatChoice[],
        choiceKind: 'item',
      };
    }
  }

  return {
    answer: truncate(top.body),
    article: top.article,
    title: `Artículo ${top.number}`,
    summary: top.body,
    nextStep: 'Si necesitas más detalle, contacta a Recursos Humanos o a tu líder directo.',
    contact: HR_CONTACT,
  };
}

// --- AI prototype -------------------------------------------------------
const CHAT_PATH = '/api/chat';
const CHAT_URL = Platform.OS === 'web' ? CHAT_PATH : 'https://conoxxo.plaza-oaxaca.workers.dev' + CHAT_PATH;
// null = not asked yet; false = this account isn't enabled (don't ask again
// until the app restarts).
let iaHabilitada: boolean | null = null;

async function preguntarIa(question: string): Promise<QAResult | null> {
  if (iaHabilitada === false) return null;
  const llave = await leerLlave();
  if (!llave) return null;
  const control = new AbortController();
  const t = setTimeout(() => control.abort(), 20000);
  try {
    const r = await fetch(CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pregunta: question, llave }),
      signal: control.signal,
    });
    const d = await r.json().catch(() => null);
    if (r.status === 403 && d?.error === 'no_habilitado') {
      iaHabilitada = false;
      return null;
    }
    if (!r.ok || !d?.ok || !d.respuesta) return null;
    iaHabilitada = true;
    const f = d.fuente as { article: string; number: number; body: string } | null;
    return {
      answer: String(d.respuesta),
      article: f ? f.article : 'Reglamento',
      title: f ? 'Reglamento Interior de Trabajo' : 'Sin artículo exacto',
      summary: f ? f.body : 'La respuesta no se basó en un artículo específico del reglamento.',
      nextStep: 'Respuesta de prueba escrita con IA a partir del reglamento. Si tu caso es delicado o algo no coincide, confírmalo con Recursos Humanos.',
      contact: HR_CONTACT,
      ia: true,
      articuloNumero: f ? f.number : undefined,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// What the chat shows: the AI answer when there is one. If the article the AI
// based it on has an interactive list (sanciones, items), that list goes below
// the AI text, so the detail is one tap away and matches what it just said.
export async function answerQuestion(question: string): Promise<QAResult> {
  const [busqueda, ia] = await Promise.all([matchQA(question), preguntarIa(question)]);
  if (!ia) return busqueda;
  const opciones = ia.articuloNumero ? await opcionesDe(ia.articuloNumero).catch(() => null) : null;
  if (opciones) return { ...ia, ...opciones, answer: `${ia.answer}\n\nPara ver el detalle, elige un punto:` };
  return ia;
}

export async function getSancion(
  id: number
): Promise<{ infraccion: string; pasos: string[]; articleNumber: number } | null> {
  const { data, error } = await supabase.rpc('get_sancion', { p_id: id });
  if (error || !data || data.length === 0) return null;
  return { infraccion: data[0].infraccion, pasos: data[0].pasos, articleNumber: data[0].article_number };
}

export async function getReglamentoItem(
  id: number
): Promise<{ label: string; body: string; articleNumber: number } | null> {
  const { data, error } = await supabase.rpc('get_reglamento_item', { p_id: id });
  if (error || !data || data.length === 0) return null;
  return { label: data[0].label, body: data[0].body, articleNumber: data[0].article_number };
}

export const chatSuggestions = [
  '¿Cuándo es retardo?',
  '¿Cómo pido vacaciones?',
  '¿Cómo solicito un permiso?',
];

// Suggestions: 3 of the preguntas frecuentes RH approved (migration 44), a
// different mix each time; the fixed ones while there are none.
export async function cargarSugerencias(): Promise<string[]> {
  try {
    const { data, error } = await supabase.rpc('faq_reglamento_aprobadas');
    const preguntas = !error && Array.isArray(data) ? (data as { pregunta: string }[]).map((f) => f.pregunta).filter(Boolean) : [];
    if (preguntas.length < 3) return chatSuggestions;
    return preguntas
      .map((p) => ({ p, orden: Math.random() }))
      .sort((a, b) => a.orden - b.orden)
      .slice(0, 3)
      .map((x) => x.p);
  } catch {
    return chatSuggestions;
  }
}

export const initialChatMessages: ChatMessage[] = [
  {
    id: 'welcome',
    role: 'assistant',
    text: 'Hola, soy el asistente de Conoxxo. Pregúntame sobre el reglamento, permisos, vacaciones o asistencia.',
  },
];
