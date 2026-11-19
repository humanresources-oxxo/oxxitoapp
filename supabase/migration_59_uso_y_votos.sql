-- Migration 59: how the app is used, without knowing who.
-- Run once in Supabase SQL Editor, after 58.
--
-- 1. People per apartado per day (uso_vistas). Each open is stored as a hash
--    of the employee number with a random salt OF THAT DAY only (uso_sal). The
--    salt of past days is deleted, so from the next day on nobody (not even
--    whoever reads the database) can tell who opened what: only how many.
-- 2. "¿Te sirvió?" of the chat (chat_votos): article, whether the AI wrote the
--    answer, and the vote. Never the question nor who voted. A separate count
--    per employee and day (chat_votos_cuenta) only caps abuse at 60 a day.
-- 3. sesion_uso_resumen: the numbers for the Panel Conoxxo (RH only).

begin;

create table if not exists uso_sal (
  dia date primary key,
  sal text not null
);
create table if not exists uso_vistas (
  dia date not null,
  apartado text not null,
  quien text not null,
  primary key (dia, apartado, quien)
);
create table if not exists chat_votos (
  id bigserial primary key,
  dia date not null,
  articulo int,
  ia boolean not null default false,
  voto smallint not null check (voto in (-1, 1))
);
create index if not exists chat_votos_dia_idx on chat_votos (dia);
create table if not exists chat_votos_cuenta (
  numero_empleado text not null,
  dia date not null,
  n int not null default 0,
  primary key (numero_empleado, dia)
);

alter table uso_sal enable row level security;
alter table uso_vistas enable row level security;
alter table chat_votos enable row level security;
alter table chat_votos_cuenta enable row level security;
revoke all on table uso_sal, uso_vistas, chat_votos, chat_votos_cuenta from public, anon, authenticated;

-- The app calls this when a screen opens (once per screen and day per phone).
-- Returns 'ok' | 'no_session' | 'invalid'.
create or replace function sesion_uso_registrar(p_token text, p_apartado text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  numero text := sesion_empleado(p_token);
  hoy date := (now() at time zone 'America/Mexico_City')::date;
  s text;
begin
  if numero is null then return 'no_session'; end if;
  if p_apartado not in ('home', 'chat', 'notifications', 'directory', 'profile', 'actas', 'vacaciones', 'estructura',
                        'cuota', 'cct', 'dilos', 'votaciones', 'altas', 'resumen') then
    return 'invalid';
  end if;
  insert into uso_sal (dia, sal) values (hoy, encode(gen_random_bytes(16), 'hex')) on conflict (dia) do nothing;
  -- Yesterday's salt goes: its hashes can no longer be tied to anyone.
  delete from uso_sal where dia < hoy;
  delete from uso_vistas where dia < hoy - 400;
  select u.sal into s from uso_sal u where u.dia = hoy;
  insert into uso_vistas (dia, apartado, quien)
  values (hoy, p_apartado, encode(digest(s || ':' || numero, 'sha256'), 'hex'))
  on conflict do nothing;
  return 'ok';
end;
$$;

-- "¿Te sirvió?" Returns 'ok' | 'no_session' | 'invalid' | 'limite'.
create or replace function sesion_chat_votar(p_token text, p_articulo int, p_ia boolean, p_voto int)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  numero text := sesion_empleado(p_token);
  hoy date := (now() at time zone 'America/Mexico_City')::date;
  total int;
begin
  if numero is null then return 'no_session'; end if;
  if p_voto not in (-1, 1) or (p_articulo is not null and p_articulo not between 1 and 300) then return 'invalid'; end if;
  delete from chat_votos_cuenta where dia < hoy;
  insert into chat_votos_cuenta as c (numero_empleado, dia, n) values (numero, hoy, 1)
  on conflict (numero_empleado, dia) do update set n = c.n + 1 where c.n < 60
  returning c.n into total;
  if total is null then return 'limite'; end if;
  insert into chat_votos (dia, articulo, ia, voto) values (hoy, p_articulo, coalesce(p_ia, false), p_voto::smallint);
  return 'ok';
end;
$$;

-- For the Panel Conoxxo (who manages personnel).
-- { estado, dias: [{dia, apartado, personas}] (last 28 days),
--   votos: [{articulo, utiles, no_utiles, ia_utiles, ia_no_utiles}] (last 60 days),
--   avisos: {celulares, personas} }
create or replace function sesion_uso_resumen(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  numero text := sesion_empleado(p_token);
  hoy date := (now() at time zone 'America/Mexico_City')::date;
begin
  if numero is null then return jsonb_build_object('estado', 'no_session'); end if;
  if not empleado_gestiona_personal(numero) then return jsonb_build_object('estado', 'not_allowed'); end if;
  return jsonb_build_object(
    'estado', 'ok',
    'dias', coalesce((
      select jsonb_agg(jsonb_build_object('dia', d.dia, 'apartado', d.apartado, 'personas', d.personas) order by d.dia desc, d.apartado)
      from (select v.dia, v.apartado, count(*) as personas from uso_vistas v where v.dia > hoy - 28 group by v.dia, v.apartado) d
    ), '[]'::jsonb),
    'votos', coalesce((
      select jsonb_agg(jsonb_build_object('articulo', x.articulo, 'utiles', x.utiles, 'no_utiles', x.no_utiles, 'ia_utiles', x.ia_utiles, 'ia_no_utiles', x.ia_no_utiles) order by x.no_utiles desc, x.articulo)
      from (
        select c.articulo,
               count(*) filter (where c.voto = 1) as utiles,
               count(*) filter (where c.voto = -1) as no_utiles,
               count(*) filter (where c.voto = 1 and c.ia) as ia_utiles,
               count(*) filter (where c.voto = -1 and c.ia) as ia_no_utiles
        from chat_votos c where c.dia > hoy - 60 group by c.articulo
      ) x
    ), '[]'::jsonb),
    'avisos', (select jsonb_build_object('celulares', count(*), 'personas', count(distinct s.numero_empleado)) from push_suscripciones s)
  );
end;
$$;

grant execute on function sesion_uso_registrar(text, text) to anon, authenticated;
grant execute on function sesion_chat_votar(text, int, boolean, int) to anon, authenticated;
grant execute on function sesion_uso_resumen(text) to anon, authenticated;

commit;

NOTIFY pgrst, 'reload schema';
