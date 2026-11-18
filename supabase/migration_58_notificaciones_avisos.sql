-- Migration 58: notifications of new avisos on the phone (web push).
-- Run once in Supabase SQL Editor, after 57. Until the Worker has its keys
-- (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY in Cloudflare) nothing is sent.
--
-- push_suscripciones: one row per phone that turned notifications on. The
-- endpoint is the push service address of that phone (Google, Apple, Mozilla
-- or Microsoft); p256dh and auth are the phone's public keys to encrypt the
-- message. Closed table: only these functions touch it.
--
-- Sending: after someone publishes an aviso, their app asks the Worker to
-- send it in batches. Each batch is claimed here atomically (ultimo_aviso is
-- set before sending), so a retry continues where it stopped and nobody gets
-- the same aviso twice. Only the newest aviso, and only within 30 minutes of
-- its publication, can be sent.

begin;

create table if not exists push_suscripciones (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  numero_empleado text not null,
  creada timestamptz not null default now(),
  ultimo_aviso uuid,
  ultimo_envio timestamptz
);
create index if not exists push_suscripciones_numero_idx on push_suscripciones (numero_empleado);

alter table push_suscripciones enable row level security;
revoke all on table push_suscripciones from public, anon, authenticated;

-- Only https addresses of the browsers' push services.
create or replace function push_endpoint_valido(p_endpoint text)
returns boolean
language sql
immutable
as $$
  select coalesce(char_length(p_endpoint) between 20 and 1000, false)
    and p_endpoint ~ '^https://([a-z0-9-]+\.)*(fcm\.googleapis\.com|push\.services\.mozilla\.com|notify\.windows\.com|push\.apple\.com)/';
$$;
revoke execute on function push_endpoint_valido(text) from public, anon, authenticated;

-- Turn notifications on for this phone. Returns 'ok' | 'no_session' | 'invalid'.
create or replace function sesion_push_guardar(p_token text, p_endpoint text, p_p256dh text, p_auth text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  numero text := sesion_empleado(p_token);
  ultimo uuid;
begin
  if numero is null then return 'no_session'; end if;
  if not push_endpoint_valido(p_endpoint)
     or coalesce(p_p256dh, '') !~ '^[A-Za-z0-9_-]{86,88}={0,2}$'
     or coalesce(p_auth, '') !~ '^[A-Za-z0-9_-]{21,24}={0,2}$' then
    return 'invalid';
  end if;
  -- A phone that turns them on now does not get the avisos already published.
  select n.id into ultimo from notices n order by n.published_at desc limit 1;
  insert into push_suscripciones (endpoint, p256dh, auth, numero_empleado, ultimo_aviso)
  values (p_endpoint, p_p256dh, p_auth, numero, ultimo)
  on conflict (endpoint) do update
    set p256dh = excluded.p256dh, auth = excluded.auth, numero_empleado = excluded.numero_empleado, creada = now();
  -- At most 5 phones per employee: the oldest go.
  delete from push_suscripciones s
  where s.numero_empleado = numero
    and s.endpoint not in (select x.endpoint from push_suscripciones x where x.numero_empleado = numero order by x.creada desc limit 5);
  return 'ok';
end;
$$;

-- Turn them off (button, or logout). Returns 'ok' | 'no_session'.
create or replace function sesion_push_borrar(p_token text, p_endpoint text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  numero text := sesion_empleado(p_token);
begin
  if numero is null then return 'no_session'; end if;
  delete from push_suscripciones where endpoint = p_endpoint and numero_empleado = numero;
  return 'ok';
end;
$$;

-- Next batch of phones for the newest aviso (only who may publish avisos).
-- { estado: 'ok', aviso: {id, title, priority}, destinos: [{endpoint, p256dh, auth}], quedan }
-- { estado: 'sin_aviso' } when there is no aviso from the last 30 minutes.
create or replace function sesion_push_lote(p_token text, p_limite int)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  adm record;
  aviso record;
  destinos jsonb;
  quedan int;
begin
  select * into adm from sesion_admin(p_token);
  if adm.estado <> 'ok' then return jsonb_build_object('estado', adm.estado); end if;

  select n.id, n.title, n.priority, n.published_at into aviso from notices n order by n.published_at desc limit 1;
  if aviso.id is null or aviso.published_at < now() - interval '30 minutes' then
    return jsonb_build_object('estado', 'sin_aviso');
  end if;

  -- Phones of people who left the roster go.
  delete from push_suscripciones s where not exists (select 1 from employees e where e.numero_empleado = s.numero_empleado);

  with elegidas as (
    select s.endpoint from push_suscripciones s
    where s.ultimo_aviso is distinct from aviso.id
    order by s.endpoint
    limit least(greatest(coalesce(p_limite, 0), 1), 40)
    for update skip locked
  ), marcadas as (
    update push_suscripciones s set ultimo_aviso = aviso.id, ultimo_envio = now()
    from elegidas e where s.endpoint = e.endpoint
    returning s.endpoint, s.p256dh, s.auth
  )
  select coalesce(jsonb_agg(jsonb_build_object('endpoint', endpoint, 'p256dh', p256dh, 'auth', auth)), '[]'::jsonb) into destinos from marcadas;

  select count(*) into quedan from push_suscripciones s where s.ultimo_aviso is distinct from aviso.id;
  return jsonb_build_object('estado', 'ok', 'aviso', jsonb_build_object('id', aviso.id, 'title', aviso.title, 'priority', aviso.priority), 'destinos', destinos, 'quedan', quedan);
end;
$$;

-- The caller's own phones, for "Enviar una prueba a mi celular".
-- { estado: 'ok', destinos: [...] } | { estado: 'no_session' }
create or replace function sesion_push_mios(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  numero text := sesion_empleado(p_token);
begin
  if numero is null then return jsonb_build_object('estado', 'no_session'); end if;
  return jsonb_build_object('estado', 'ok', 'destinos', coalesce((
    select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
    from push_suscripciones s where s.numero_empleado = numero), '[]'::jsonb));
end;
$$;

-- Phones the push service says no longer exist (404/410): the Worker removes
-- them. Only rows the caller could have been given: its own, or any if it may
-- publish avisos.
create or replace function sesion_push_vencidas(p_token text, p_endpoints text[])
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  numero text := sesion_empleado(p_token);
  adm record;
begin
  if numero is null then return 'no_session'; end if;
  select * into adm from sesion_admin(p_token);
  delete from push_suscripciones s
  where s.endpoint = any(coalesce(p_endpoints, '{}'))
    and (adm.estado = 'ok' or s.numero_empleado = numero);
  return 'ok';
end;
$$;

grant execute on function sesion_push_guardar(text, text, text, text) to anon, authenticated;
grant execute on function sesion_push_borrar(text, text) to anon, authenticated;
grant execute on function sesion_push_lote(text, int) to anon, authenticated;
grant execute on function sesion_push_mios(text) to anon, authenticated;
grant execute on function sesion_push_vencidas(text, text[]) to anon, authenticated;

commit;

NOTIFY pgrst, 'reload schema';

-- How many phones have notifications on (SQL Editor):
--   select count(*) as celulares, count(distinct numero_empleado) as personas from push_suscripciones;
