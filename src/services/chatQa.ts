// src/services/chatQa.ts
// Real-reglamento QA: full-text search over the RIT articles table (Supabase), no LLM.
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

  if (top.number === 77) {
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
  'Cuando es retardo?',
  'Como pido vacaciones?',
  'Como solicito un permiso?',
];

export const initialChatMessages: ChatMessage[] = [
  {
    id: 'welcome',
    role: 'assistant',
    text: 'Hola, soy Oxxito. Preguntame sobre el reglamento, permisos, vacaciones o asistencia.',
  },
];
