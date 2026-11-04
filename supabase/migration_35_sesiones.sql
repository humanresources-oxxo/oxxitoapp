-- Migration 35: session keys, so avisos and votaciones no longer ask for a
-- passcode or PIN. Run once in Supabase SQL Editor, after migration 34.
--
-- At login (PIN), the app asks iniciar_sesion for a random key and keeps it
-- on the phone; the database keeps only its SHA-256. Functions that act as an
-- employee take that key instead of a PIN, so nobody can act as someone else
-- just by knowing their employee number. A PIN change or reset ends that
-- employee's keys. Keys last 180 days from their last use.
--
-- Avisos and votaciones (create, close, delete) are for the puestos of
-- voto_puede_administrar (migration 34): RH (Responsable RH, Analista
-- Experiencia Colaborador, Practicante), Gerente Plaza and the test account.
-- create_notice (RH passcode) stays for the separate admin web panel.

create table if not exists app_sessions (
  token_hash text primary key,
  numero_empleado text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '180 days'
);
create index if not exists app_sessions_numero on app_sessions(numero_empleado);
alter table app_sessions enable row level security;
-- No policies: only reachable through the security-definer functions below.

-- A new, changed or reset PIN ends that employee's sessions.
create or replace function app_sessions_fin_por_pin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from app_sessions where numero_empleado = old.numero_empleado;
  return new;
end;
$$;

drop trigger if exists employees_pin_cambia on employees;
create trigger employees_pin_cambia
  after update of pin_hash on employees
  for each row
  when (old.pin_hash is distinct from new.pin_hash)
  execute function app_sessions_fin_por_pin();

-- Returns verify_pin's status and, when 'ok', a new key (only time it is
-- ever shown).
create or replace function iniciar_sesion(p_numero text, p_pin text)
returns table(status text, token text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  pin_status text;
  nueva text;
begin
  select s.status into pin_status from verify_pin(p_numero, p_pin) s;
  if pin_status is distinct from 'ok' then
    return query select coalesce(pin_status, 'not_found'), null::text;
    return;
  end if;

  delete from app_sessions where expires_at < now();
  nueva := encode(gen_random_bytes(32), 'hex');
  insert into app_sessions (token_hash, numero_empleado)
  values (encode(digest(nueva, 'sha256'), 'hex'), p_numero);
  return query select 'ok'::text, nueva;
end;
$$;

create or replace function cerrar_sesion(p_token text)
returns void
language sql
security definer
set search_path = public, extensions
as $$
  delete from app_sessions where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
$$;

-- Employee number of a valid key (and pushes its expiry), or null.
create or replace function sesion_empleado(p_token text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  numero text;
begin
  update app_sessions s
  set expires_at = now() + interval '180 days'
  where s.token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
    and s.expires_at > now()
    and exists (select 1 from employees e where e.numero_empleado = s.numero_empleado)
  returning s.numero_empleado into numero;
  return numero;
end;
$$;

-- Employee number of a valid key whose puesto can publish, or the status to
-- return: 'no_session' | 'not_allowed'.
create or replace function sesion_admin(p_token text, out numero text, out estado text)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  numero := sesion_empleado(p_token);
  if numero is null then
    estado := 'no_session';
  elsif not voto_puede_administrar((select e.puesto from employees e where e.numero_empleado = numero)) then
    estado := 'not_allowed';
  else
    estado := 'ok';
  end if;
end;
$$;

-- === Votaciones with the session key (replace migration 34's PIN versions) ===
drop function if exists votar(text, text, uuid, uuid);
drop function if exists crear_votacion(text, text, text, text, text[], text[], timestamptz, boolean);
drop function if exists cerrar_votacion(text, text, uuid);
drop function if exists borrar_votacion(text, text, uuid);
drop function if exists voto_check_admin(text, text);

-- Returns 'ok' | 'no_session' | 'not_found' | 'not_allowed' | 'closed' |
-- 'bad_option' | 'already_voted'.
create or replace function sesion_votar(p_token text, p_votacion uuid, p_opcion uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  numero text;
  emp_tienda text;
  v votaciones%rowtype;
  inserted int;
begin
  numero := sesion_empleado(p_token);
  if numero is null then
    return 'no_session';
  end if;

  select * into v from votaciones where votaciones.id = p_votacion;
  if not found then
    return 'not_found';
  end if;
  select e.tienda into emp_tienda from employees e where e.numero_empleado = numero;
  if not voto_en_tiendas(emp_tienda, v.tiendas) then
    return 'not_allowed';
  end if;
  if v.cerrada_en is not null or v.cierra_en <= now() then
    return 'closed';
  end if;
  if not exists (select 1 from votacion_opciones o where o.id = p_opcion and o.votacion_id = p_votacion) then
    return 'bad_option';
  end if;

  insert into votacion_participantes (votacion_id, numero_empleado)
  values (p_votacion, numero)
  on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then
    return 'already_voted';
  end if;

  update votacion_opciones set votos = votos + 1 where id = p_opcion;
  return 'ok';
end;
$$;

-- Returns 'ok' | 'no_session' | 'not_allowed' | 'bad_title' |
-- 'bad_options' | 'bad_date'. A votación for everyone is also an aviso.
create or replace function sesion_crear_votacion(
  p_token text,
  p_titulo text,
  p_descripcion text,
  p_opciones text[],
  p_tiendas text[],
  p_cierra_en timestamptz,
  p_en_vivo boolean
)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  adm record;
  opciones text[];
  tiendas text[];
  nueva uuid;
begin
  select * into adm from sesion_admin(p_token);
  if adm.estado <> 'ok' then
    return adm.estado;
  end if;

  if char_length(trim(coalesce(p_titulo, ''))) not between 3 and 120 then
    return 'bad_title';
  end if;

  -- Trimmed, non-empty, no repeats (ignoring case), original order.
  select array_agg(t order by primera) into opciones
  from (
    select (array_agg(trim(x) order by n))[1] as t, min(n) as primera
    from unnest(coalesce(p_opciones, '{}')) with ordinality as u(x, n)
    where trim(x) <> ''
    group by lower(trim(x))
  ) s;
  if coalesce(cardinality(opciones), 0) not between 2 and 10
     or exists (select 1 from unnest(opciones) o where char_length(o) > 80) then
    return 'bad_options';
  end if;

  if p_cierra_en is null or p_cierra_en < now() + interval '10 minutes' or p_cierra_en > now() + interval '90 days' then
    return 'bad_date';
  end if;

  select coalesce(array_agg(distinct voto_norm_tienda(t)) filter (where voto_norm_tienda(t) <> ''), '{}')
  into tiendas
  from unnest(coalesce(p_tiendas, '{}')) t;

  insert into votaciones (titulo, descripcion, tiendas, resultados_en_vivo, creada_por, cierra_en)
  values (trim(p_titulo), trim(coalesce(p_descripcion, '')), tiendas, coalesce(p_en_vivo, false), adm.numero, p_cierra_en)
  returning votaciones.id into nueva;

  insert into votacion_opciones (votacion_id, orden, texto)
  select nueva, n, o from unnest(opciones) with ordinality as u(o, n);

  if cardinality(tiendas) = 0 then
    insert into notices (title, body, kind, priority)
    values (
      'Nueva votación: ' || trim(p_titulo),
      concat_ws(' ',
        nullif(trim(coalesce(p_descripcion, '')), ''),
        'Vota desde Inicio → Votaciones antes del ' ||
        to_char(p_cierra_en at time zone 'America/Mexico_City', 'DD/MM/YYYY "a las" HH24:MI') || '.'),
      'vote',
      false
    );
  end if;

  return 'ok';
end;
$$;

create or replace function sesion_cerrar_votacion(p_token text, p_votacion uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  adm record;
begin
  select * into adm from sesion_admin(p_token);
  if adm.estado <> 'ok' then
    return adm.estado;
  end if;
  update votaciones set cerrada_en = now() where id = p_votacion and cerrada_en is null and cierra_en > now();
  return 'ok';
end;
$$;

create or replace function sesion_borrar_votacion(p_token text, p_votacion uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  adm record;
begin
  select * into adm from sesion_admin(p_token);
  if adm.estado <> 'ok' then
    return adm.estado;
  end if;
  delete from votaciones where id = p_votacion;
  return 'ok';
end;
$$;

-- === Avisos with the session key ===
-- Returns 'ok' | 'no_session' | 'not_allowed' | 'bad_notice'.
create or replace function sesion_publicar_aviso(p_token text, p_title text, p_body text, p_kind text, p_priority boolean)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  adm record;
begin
  select * into adm from sesion_admin(p_token);
  if adm.estado <> 'ok' then
    return adm.estado;
  end if;
  if char_length(trim(coalesce(p_title, ''))) < 3 or char_length(trim(coalesce(p_body, ''))) < 3
     or p_kind not in ('policy', 'training', 'schedule', 'benefit') then
    return 'bad_notice';
  end if;
  insert into notices (title, body, kind, priority)
  values (trim(p_title), trim(p_body), p_kind, coalesce(p_priority, false));
  return 'ok';
end;
$$;

-- Internal helpers stay private; the app calls the rest.
revoke execute on function sesion_empleado(text) from public, anon, authenticated;
revoke execute on function sesion_admin(text) from public, anon, authenticated;
revoke execute on function app_sessions_fin_por_pin() from public, anon, authenticated;
grant execute on function iniciar_sesion(text, text) to anon, authenticated;
grant execute on function cerrar_sesion(text) to anon, authenticated;
grant execute on function sesion_votar(text, uuid, uuid) to anon, authenticated;
grant execute on function sesion_crear_votacion(text, text, text, text[], text[], timestamptz, boolean) to anon, authenticated;
grant execute on function sesion_cerrar_votacion(text, uuid) to anon, authenticated;
grant execute on function sesion_borrar_votacion(text, uuid) to anon, authenticated;
grant execute on function sesion_publicar_aviso(text, text, text, text, boolean) to anon, authenticated;

NOTIFY pgrst, 'reload schema';
