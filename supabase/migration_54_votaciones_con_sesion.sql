-- Migration 54: the list of votaciones is read with the session key. Run once
-- in Supabase SQL Editor, after 53 and BEFORE publishing the app version that
-- uses it.
--
-- list_votaciones(numero) answered to the public key with an employee number
-- alone: the votaciones that person can see, whether THEY already voted in
-- each one and, when the number belongs to RH or the Gerente de plaza, the
-- live counts of open votaciones. Voting and managing already need the
-- session key (migration 35); the list was the one thing left behind.
--
-- This migration only ADDS sesion_votaciones(llave): the same rows, for the
-- employee of that session key. Without a valid key it fails with
-- 'sesion_conoxxo' (the app asks for the PIN once). list_votaciones is closed
-- in migration_55_cerrar_list_votaciones.sql, once the new app is out.

begin;

create or replace function sesion_votaciones(p_token text)
returns table(
  id text,
  titulo text,
  descripcion text,
  cierra_en timestamptz,
  abierta boolean,
  ya_voto boolean,
  puede_votar boolean,
  participantes int,
  resultados_en_vivo boolean,
  para_todos boolean,
  ver_resultados boolean,
  puede_administrar boolean,
  opciones jsonb
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  numero text := sesion_empleado(p_token);
begin
  if numero is null then
    raise exception 'sesion_conoxxo';
  end if;
  return query
  select v.id, v.titulo, v.descripcion, v.cierra_en, v.abierta, v.ya_voto, v.puede_votar, v.participantes,
         v.resultados_en_vivo, v.para_todos, v.ver_resultados, v.puede_administrar, v.opciones
  from list_votaciones(numero) v;
end;
$$;

grant execute on function sesion_votaciones(text) to anon, authenticated;

commit;

NOTIFY pgrst, 'reload schema';
