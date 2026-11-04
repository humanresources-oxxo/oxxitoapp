-- Migration 34: Votaciones (secret ballots for places, dates and similar
-- team decisions). Run once in Supabase SQL Editor.
--
-- Secrecy: who voted (votacion_participantes) and what was voted
-- (votacion_opciones.votos, a plain counter) are never stored together, and
-- neither has a timestamp, so not even RH can tell who voted what.
-- Every vote is confirmed with the employee's PIN (same lockout as login),
-- so one person = one vote even if someone knows another's number.
-- Votaciones are created from the app by RH puestos, also confirmed with PIN.

create table if not exists votaciones (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (char_length(titulo) between 3 and 120),
  descripcion text not null default '' check (char_length(descripcion) <= 600),
  -- Normalized store names (voto_norm_tienda); empty = everyone.
  tiendas text[] not null default '{}',
  resultados_en_vivo boolean not null default false,
  creada_por text not null,
  creada_en timestamptz not null default now(),
  cierra_en timestamptz not null,
  cerrada_en timestamptz
);

create table if not exists votacion_opciones (
  id uuid primary key default gen_random_uuid(),
  votacion_id uuid not null references votaciones(id) on delete cascade,
  orden int not null,
  texto text not null check (char_length(texto) between 1 and 80),
  votos int not null default 0
);
create index if not exists votacion_opciones_votacion on votacion_opciones(votacion_id);

create table if not exists votacion_participantes (
  votacion_id uuid not null references votaciones(id) on delete cascade,
  numero_empleado text not null,
  primary key (votacion_id, numero_empleado)
);

alter table votaciones enable row level security;
alter table votacion_opciones enable row level security;
alter table votacion_participantes enable row level security;
-- No policies: only reachable through the security-definer functions below.

-- Avisos get a new kind so a new votación can be announced.
alter table notices drop constraint if exists notices_kind_check;
alter table notices add constraint notices_kind_check
  check (kind in ('policy', 'training', 'schedule', 'benefit', 'vote'));

-- Same as normalizarTienda in the app: "OXXO Las Flores" = "Las Flores OAX".
create or replace function voto_norm_tienda(t text)
returns text
language sql
immutable
as $$
  select regexp_replace(
    trim(regexp_replace(
      regexp_replace(
        regexp_replace(
          upper(translate(coalesce(t, ''), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')),
          '^OXXO\s+', ''),
        '^TIENDA\s+', ''),
      '[^A-Z0-9]+', ' ', 'g')),
    '\s(OAX|VSA)$', '');
$$;

-- Whether an employee's store (roster) is one of a votación's stores. Payroll
-- cuts long store names at 25 characters ("OXXO SAN JOSE DEL PROGRES"): such
-- a name matches the one store it starts.
create or replace function voto_en_tiendas(p_tienda text, p_tiendas text[])
returns boolean
language sql
immutable
as $$
  select cardinality(p_tiendas) = 0
    or voto_norm_tienda(p_tienda) = any (p_tiendas)
    or (
      char_length(trim(coalesce(p_tienda, ''))) >= 25
      and char_length(voto_norm_tienda(p_tienda)) >= 12
      and (select count(*) from unnest(p_tiendas) t where t like voto_norm_tienda(p_tienda) || '%') = 1
    );
$$;

-- RH puestos that can create, close and delete votaciones (prefix match,
-- without accents or case, like PUESTOS_ACTAS in the app).
create or replace function voto_puede_administrar(p_puesto text)
returns boolean
language sql
immutable
as $$
  select exists (
    select 1
    from unnest(array[
      'RESPONSABLE RECURSOS HUMANOS',
      'GERENTE PLAZA',
      'ANALISTA EXPERIENCIA COLABORADOR',
      'PRACTICANTE',
      'ACCES TEST'
    ]) as permitido
    where regexp_replace(upper(translate(coalesce(p_puesto, ''), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')), '\s+', ' ', 'g')
      like permitido || '%'
  );
$$;

-- Votaciones the employee can see: open ones and those closed in the last
-- 60 days. Vote counts only once it closes, or right after voting when the
-- votación shows live results; RH always sees them.
drop function if exists list_votaciones(text);
create or replace function list_votaciones(p_numero text)
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
set search_path = public
as $$
declare
  emp_tienda text;
  emp_puesto text;
  es_admin boolean;
begin
  select e.tienda, e.puesto into emp_tienda, emp_puesto
  from employees e where e.numero_empleado = p_numero;
  if not found then
    return;
  end if;
  es_admin := voto_puede_administrar(emp_puesto);

  return query
  with base as (
    select v.*,
      (v.cerrada_en is null and v.cierra_en > now()) as esta_abierta,
      exists (select 1 from votacion_participantes p where p.votacion_id = v.id and p.numero_empleado = p_numero) as voto
    from votaciones v
    where (es_admin or voto_en_tiendas(emp_tienda, v.tiendas))
      and coalesce(v.cerrada_en, v.cierra_en) > now() - interval '60 days'
  )
  select
    b.id::text,
    b.titulo,
    b.descripcion,
    coalesce(b.cerrada_en, b.cierra_en),
    b.esta_abierta,
    b.voto,
    voto_en_tiendas(emp_tienda, b.tiendas),
    (select count(*)::int from votacion_participantes p where p.votacion_id = b.id),
    b.resultados_en_vivo,
    cardinality(b.tiendas) = 0,
    (es_admin or not b.esta_abierta or (b.resultados_en_vivo and b.voto)),
    es_admin,
    (
      select jsonb_agg(jsonb_build_object(
        'id', o.id::text,
        'texto', o.texto,
        'votos', case when es_admin or not b.esta_abierta or (b.resultados_en_vivo and b.voto) then o.votos end
      ) order by o.orden)
      from votacion_opciones o where o.votacion_id = b.id
    )
  from base b
  order by b.esta_abierta desc, b.voto asc, coalesce(b.cerrada_en, b.cierra_en) asc;
end;
$$;

-- Returns 'ok' | 'wrong_pin' | 'locked' | 'not_found' | 'not_allowed' |
-- 'closed' | 'bad_option' | 'already_voted'.
create or replace function votar(p_numero text, p_pin text, p_votacion uuid, p_opcion uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  pin_status text;
  emp_tienda text;
  v votaciones%rowtype;
  inserted int;
begin
  select s.status into pin_status from verify_pin(p_numero, p_pin) s;
  if pin_status is distinct from 'ok' then
    return coalesce(pin_status, 'not_found');
  end if;

  select * into v from votaciones where votaciones.id = p_votacion;
  if not found then
    return 'not_found';
  end if;
  select e.tienda into emp_tienda from employees e where e.numero_empleado = p_numero;
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
  values (p_votacion, p_numero)
  on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then
    return 'already_voted';
  end if;

  update votacion_opciones set votos = votos + 1 where id = p_opcion;
  return 'ok';
end;
$$;

-- PIN + RH puesto check shared by the admin functions. Returns the same
-- statuses as verify_pin, or 'not_allowed'.
create or replace function voto_check_admin(p_numero text, p_pin text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  pin_status text;
  emp_puesto text;
begin
  select s.status into pin_status from verify_pin(p_numero, p_pin) s;
  if pin_status is distinct from 'ok' then
    return coalesce(pin_status, 'not_found');
  end if;
  select e.puesto into emp_puesto from employees e where e.numero_empleado = p_numero;
  if not voto_puede_administrar(emp_puesto) then
    return 'not_allowed';
  end if;
  return 'ok';
end;
$$;

-- Returns 'ok' | a voto_check_admin status | 'bad_title' | 'bad_options' |
-- 'bad_date'. A votación for everyone is also announced in Avisos.
create or replace function crear_votacion(
  p_numero text,
  p_pin text,
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
  st text;
  opciones text[];
  tiendas text[];
  nueva uuid;
begin
  st := voto_check_admin(p_numero, p_pin);
  if st <> 'ok' then
    return st;
  end if;

  if char_length(trim(coalesce(p_titulo, ''))) not between 3 and 120 then
    return 'bad_title';
  end if;

  -- Trimmed, non-empty, no repeats, original order.
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
  values (trim(p_titulo), trim(coalesce(p_descripcion, '')), tiendas, coalesce(p_en_vivo, false), p_numero, p_cierra_en)
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

create or replace function cerrar_votacion(p_numero text, p_pin text, p_votacion uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  st text;
begin
  st := voto_check_admin(p_numero, p_pin);
  if st <> 'ok' then
    return st;
  end if;
  update votaciones set cerrada_en = now() where id = p_votacion and cerrada_en is null and cierra_en > now();
  return 'ok';
end;
$$;

create or replace function borrar_votacion(p_numero text, p_pin text, p_votacion uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  st text;
begin
  st := voto_check_admin(p_numero, p_pin);
  if st <> 'ok' then
    return st;
  end if;
  delete from votaciones where id = p_votacion;
  return 'ok';
end;
$$;

-- Internal helpers stay private; the app only calls these five.
revoke execute on function voto_check_admin(text, text) from public, anon, authenticated;
grant execute on function list_votaciones(text) to anon, authenticated;
grant execute on function votar(text, text, uuid, uuid) to anon, authenticated;
grant execute on function crear_votacion(text, text, text, text, text[], text[], timestamptz, boolean) to anon, authenticated;
grant execute on function cerrar_votacion(text, text, uuid) to anon, authenticated;
grant execute on function borrar_votacion(text, text, uuid) to anon, authenticated;

NOTIFY pgrst, 'reload schema';
