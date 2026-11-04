// src/services/votaciones.ts
// Votaciones (secret ballots for places, dates and similar decisions), backed
// by the Supabase functions in migration_34_votaciones.sql and, for voting
// and managing them with the session key, migration_35_sesiones.sql. RH and
// Gerente de plaza create them from the app (services/sesion.ts). Counts are hidden while open unless the votación shows
// live results (after voting) or the viewer is RH.
import { supabase } from './supabaseClient';

export type OpcionVoto = { id: string; texto: string; votos: number | null };

export type Votacion = {
  id: string;
  titulo: string;
  descripcion: string;
  cierraEn: Date;
  abierta: boolean;
  yaVoto: boolean;
  // False only for RH looking at a votación meant for other stores.
  puedeVotar: boolean;
  participantes: number;
  resultadosEnVivo: boolean;
  paraTodos: boolean;
  verResultados: boolean;
  opciones: OpcionVoto[];
};

export type ListaVotaciones = { votaciones: Votacion[]; puedeAdministrar: boolean };

export type EstadoVoto =
  | 'ok'
  | 'no_session'
  | 'wrong_pin'
  | 'locked'
  | 'not_found'
  | 'not_allowed'
  | 'closed'
  | 'bad_option'
  | 'already_voted'
  | 'bad_title'
  | 'bad_options'
  | 'bad_date';

export const MENSAJE_VOTO: Record<EstadoVoto, string> = {
  ok: '',
  no_session: 'Confirma tu PIN para continuar.',
  wrong_pin: 'El PIN no es correcto.',
  locked: 'Tu cuenta quedó bloqueada 15 minutos por varios intentos con PIN incorrecto.',
  not_found: 'No encontramos la votación o tu número de empleado.',
  not_allowed: 'No tienes acceso a esta votación o a esta opción.',
  closed: 'La votación ya cerró.',
  bad_option: 'Esa opción ya no existe. Actualiza la pantalla.',
  already_voted: 'Ya habías votado en esta votación.',
  bad_title: 'El título debe tener de 3 a 120 caracteres.',
  bad_options: 'Pon de 2 a 10 opciones distintas, de máximo 80 caracteres.',
  bad_date: 'El cierre debe ser entre 10 minutos y 90 días a partir de ahora.',
};

export async function listarVotaciones(numeroEmpleado: string): Promise<ListaVotaciones> {
  const { data, error } = await supabase.rpc('list_votaciones', { p_numero: numeroEmpleado });
  if (error) throw error;
  const filas = (data ?? []) as any[];
  return {
    puedeAdministrar: filas.some((r) => r.puede_administrar),
    votaciones: filas.map((r) => ({
      id: r.id,
      titulo: r.titulo,
      descripcion: r.descripcion ?? '',
      cierraEn: new Date(r.cierra_en),
      abierta: !!r.abierta,
      yaVoto: !!r.ya_voto,
      puedeVotar: r.puede_votar !== false,
      participantes: r.participantes ?? 0,
      resultadosEnVivo: !!r.resultados_en_vivo,
      paraTodos: !!r.para_todos,
      verResultados: !!r.ver_resultados,
      opciones: (r.opciones ?? []).map((o: any) => ({ id: o.id, texto: o.texto, votos: o.votos ?? null })),
    })),
  };
}

// Open votaciones the employee hasn't voted in (the badge on Inicio).
export async function contarPendientes(numeroEmpleado: string): Promise<number> {
  const { votaciones } = await listarVotaciones(numeroEmpleado);
  return votaciones.filter((v) => v.abierta && v.puedeVotar && !v.yaVoto).length;
}

async function llamar(fn: string, args: Record<string, unknown>): Promise<EstadoVoto> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return (data as EstadoVoto) ?? 'not_found';
}

export const votar = (llave: string, votacion: string, opcion: string) =>
  llamar('sesion_votar', { p_token: llave, p_votacion: votacion, p_opcion: opcion });

export type NuevaVotacion = {
  titulo: string;
  descripcion: string;
  opciones: string[];
  tiendas: string[];
  cierraEn: Date;
  enVivo: boolean;
};

export const crearVotacion = (llave: string, v: NuevaVotacion) =>
  llamar('sesion_crear_votacion', {
    p_token: llave,
    p_titulo: v.titulo,
    p_descripcion: v.descripcion,
    p_opciones: v.opciones,
    p_tiendas: v.tiendas,
    p_cierra_en: v.cierraEn.toISOString(),
    p_en_vivo: v.enVivo,
  });

export const cerrarVotacion = (llave: string, votacion: string) =>
  llamar('sesion_cerrar_votacion', { p_token: llave, p_votacion: votacion });

export const borrarVotacion = (llave: string, votacion: string) =>
  llamar('sesion_borrar_votacion', { p_token: llave, p_votacion: votacion });
