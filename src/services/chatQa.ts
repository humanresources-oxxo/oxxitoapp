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

export type ChatMessage = {
  id: string;
  role: 'assistant' | 'user';
  text: string;
  citation?: string;
  title?: string;
  source?: ChatSource;
};

export type QAResult = {
  answer: string;
  article: string;
  title: string;
  summary: string;
  nextStep: string;
  contact?: { name: string; area: string };
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
  return {
    answer: truncate(top.body),
    article: top.article,
    title: `Artículo ${top.number}`,
    summary: top.body,
    nextStep: 'Si necesitas más detalle, contacta a Recursos Humanos o a tu líder directo.',
    contact: HR_CONTACT,
  };
}

export const chatSuggestions = [
  'Cuando es retardo?',
  'Como pido vacaciones?',
  'Que hago si olvide mi gafete?',
  'A quien entrego una incapacidad?',
  'Como solicito un permiso?',
  'Tengo duda de nomina',
];

export const initialChatMessages: ChatMessage[] = [
  {
    id: 'welcome',
    role: 'assistant',
    text: 'Hola, soy Oxxito. Preguntame sobre el reglamento, permisos, vacaciones o asistencia.',
  },
];
