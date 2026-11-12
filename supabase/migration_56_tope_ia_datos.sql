-- Migration 56: the daily AI limit (migration 51) also counts "Pregúntale a la
-- ficha" (worker/datos.js, the chatbot for office puestos), as funcion 'datos'.
-- Run once in Supabase SQL Editor, after 55. Until it runs, the Worker counts
-- that chatbot in its own memory (worker/limite.js), as before 51.
-- Same function as 51; only the list of features changes.

begin;

create or replace function sesion_ia_contar(p_token text, p_funcion text, p_limite int)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  numero text := sesion_empleado(p_token);
  hoy date := (now() at time zone 'America/Mexico_City')::date;
  total int;
begin
  if numero is null then
    return jsonb_build_object('estado', 'no_session');
  end if;
  if p_funcion not in ('chat', 'redactar', 'resumen', 'datos') or coalesce(p_limite, 0) < 1 then
    raise exception 'ia_funcion_invalida';
  end if;

  -- Counts of past months are of no use.
  delete from ia_usos where dia < hoy - 35;

  -- One statement, so two questions at the same time cannot both slip past
  -- the limit: the row is only added or raised while it is below it.
  insert into ia_usos as u (numero_empleado, funcion, dia, usos)
  values (numero, p_funcion, hoy, 1)
  on conflict (numero_empleado, funcion, dia)
  do update set usos = u.usos + 1 where u.usos < p_limite
  returning u.usos into total;

  if total is null then
    select u.usos into total from ia_usos u where u.numero_empleado = numero and u.funcion = p_funcion and u.dia = hoy;
    return jsonb_build_object('estado', 'limite', 'usos', total);
  end if;
  return jsonb_build_object('estado', 'ok', 'usos', total);
end;
$$;

grant execute on function sesion_ia_contar(text, text, int) to anon, authenticated;

commit;

NOTIFY pgrst, 'reload schema';
