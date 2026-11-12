-- Migration 51: the daily limit of the AI features is counted in Supabase.
-- Run once in Supabase SQL Editor, after 50. It can run before or after the
-- app is published: until it exists the Worker keeps its old count.
--
-- The Worker (worker/chat.js, redactar.js, resumen.js) counted each person's
-- questions per day in its own memory. Cloudflare runs many copies of the
-- Worker and restarts them at will, so the count started over all the time:
-- with the chat open to every employee, "40 al día" did not really limit what
-- is spent on Claude.
--
-- sesion_ia_contar(llave, funcion, limite) adds one use for the employee of
-- that session key, today (Mexico City day), and answers:
--   { estado: 'ok', usos }        counted, within the limit
--   { estado: 'limite', usos }    the limit was already reached (not counted)
--   { estado: 'no_session' }      the key is not valid
-- One row per employee, feature and day; no question text, only the count.
-- The limit comes from the Worker (CHAT_IA_LIMITE_DIA and the ones in its
-- code). Calling this directly with a session key can only use up one's own
-- allowance: the Worker is the one that refuses when it says 'limite'.

begin;

create table if not exists ia_usos (
  numero_empleado text not null,
  funcion text not null,
  dia date not null,
  usos int not null default 0,
  primary key (numero_empleado, funcion, dia)
);

alter table ia_usos enable row level security;
revoke all on table ia_usos from public, anon, authenticated;

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
  if p_funcion not in ('chat', 'redactar', 'resumen') or coalesce(p_limite, 0) < 1 then
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

-- To see how much each feature is used (SQL Editor):
--   select dia, funcion, count(*) as personas, sum(usos) as usos
--   from ia_usos group by dia, funcion order by dia desc, funcion;
