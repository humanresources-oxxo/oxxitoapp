-- Migration 37: access hardening (audit, step 1). Run once in Supabase SQL
-- Editor, after migration 36.
--
-- 1. PIN guessing: the lockout grows with each failure and no longer depends
--    on the caller's address (which a client can fake): 5 failures -> 15 min
--    per try, 10 -> 1 h, 20 -> 24 h; a correct PIN or an RH reset clears it.
--    verify_pin (login and session key) and change_pin share it. On top, at
--    most 30 failures per hour from one address, when the address is known.
-- 2. Trivial PINs (1234, 0000, ...) are no longer accepted, and a PIN must be
--    4 digits.
-- 3. First registration: puestos with permissions (actas, avisos,
--    votaciones, team data) can no longer create their own first PIN; RH
--    gives them a temporary one from the admin panel and the app makes them
--    change it. At most 60 first registrations per hour in total (10 per
--    address), so nobody can claim accounts in bulk.
-- 4. The admin web panel no longer uses the shared RH passcode, which had no
--    attempt limit: it signs in with employee number and PIN (session key,
--    migration 35) and only RH puestos manage employees and PINs. The
--    passcode functions and their table are dropped.
-- 5. mi_red(): temporary helper to see which address header reaches the
--    database (to confirm the per-address limits work). Drop it afterwards.

-- === Security events (for rate limits) ===
create table if not exists seguridad_eventos (
  tipo text not null,
  clave text not null,
  momento timestamptz not null default now()
);
create index if not exists seguridad_eventos_busqueda on seguridad_eventos(tipo, clave, momento);
alter table seguridad_eventos enable row level security;
-- No policies: only the functions below touch it.

-- Caller's address: the one set by the edge proxy if present, else the first
-- in X-Forwarded-For; 'unknown' when there is none (then per-address limits
-- are skipped so they never turn into a limit for everybody).
create or replace function cliente_ip()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(trim(h ->> 'cf-connecting-ip'), ''),
    nullif(trim(h ->> 'x-real-ip'), ''),
    nullif(trim(split_part(coalesce(h ->> 'x-forwarded-for', ''), ',', 1)), ''),
    'unknown')
  from (select coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json as h) s;
$$;

create or replace function seg_contar(p_tipo text, p_clave text, p_ventana interval)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from seguridad_eventos
  where tipo = p_tipo and clave = p_clave and momento > now() - p_ventana;
$$;

create or replace function seg_anotar(p_tipo text, p_clave text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into seguridad_eventos (tipo, clave) values (p_tipo, p_clave);
  -- Housekeeping now and then.
  if random() < 0.02 then
    delete from seguridad_eventos where momento < now() - interval '2 days';
  end if;
end;
$$;

-- Temporary diagnostic: the caller's own address as the database sees it.
create or replace function mi_red()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'ip', cliente_ip(),
    'cf_connecting_ip', (h ->> 'cf-connecting-ip') is not null,
    'x_real_ip', (h ->> 'x-real-ip') is not null,
    'x_forwarded_for_partes', case when h ->> 'x-forwarded-for' is null then 0
      else array_length(string_to_array(h ->> 'x-forwarded-for', ','), 1) end)
  from (select coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json as h) s;
$$;

-- === PIN rules ===
create or replace function pin_debil(p text)
returns boolean
language sql
immutable
as $$
  select coalesce(p, '') !~ '^[0-9]{4}$'
    or p ~ '^(.)\1{3}$'
    or p in ('0123', '1234', '2345', '3456', '4567', '5678', '6789',
             '9876', '8765', '7654', '6543', '5432', '4321', '3210');
$$;

-- Wait after the n-th failure in a row (null = none yet).
create or replace function pin_espera(p_fallos int)
returns interval
language sql
immutable
as $$
  select case
    when p_fallos < 5 then null
    when p_fallos < 10 then interval '15 minutes'
    when p_fallos < 20 then interval '1 hour'
    else interval '24 hours'
  end;
$$;

-- Puestos with permissions in the app (PUESTOS_ACTAS in src/services/actas.ts).
create or replace function puesto_con_permisos(p_puesto text)
returns boolean
language sql
immutable
as $$
  select exists (
    select 1
    from unnest(array[
      'ASESOR TIENDA',
      'RESPONSABLE RECURSOS HUMANOS',
      'GERENTE PLAZA',
      'ANALISTA EXPERIENCIA COLABORADOR',
      'PRACTICANTE',
      'ACCES TEST',
      'SINDICATO'
    ]) as permitido
    where regexp_replace(upper(translate(coalesce(p_puesto, ''), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')), '\s+', ' ', 'g')
      like permitido || '%'
  );
$$;

-- Puestos that manage employees and PINs in the admin panel.
create or replace function puesto_gestiona_personal(p_puesto text)
returns boolean
language sql
immutable
as $$
  select exists (
    select 1
    from unnest(array['RESPONSABLE RECURSOS HUMANOS', 'ANALISTA EXPERIENCIA COLABORADOR', 'ACCES TEST']) as permitido
    where regexp_replace(upper(translate(coalesce(p_puesto, ''), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')), '\s+', ' ', 'g')
      like permitido || '%'
  );
$$;

-- Random 4-digit PIN that is not trivial.
create or replace function pin_aleatorio()
returns text
language plpgsql
volatile
set search_path = public, extensions
as $$
declare
  p text;
begin
  loop
    p := lpad(((('x' || encode(gen_random_bytes(2), 'hex'))::bit(16)::int) % 10000)::text, 4, '0');
    exit when not pin_debil(p);
  end loop;
  return p;
end;
$$;

-- === verify_pin with the growing lockout (same signature as migration 09) ===
create or replace function verify_pin(p_numero text, p_pin text)
returns table(status text, numero_empleado text, nombre text, pin_is_temporary boolean, locked_until timestamptz)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  ip text := cliente_ip();
  row_id uuid;
  row_hash text;
  row_nombre text;
  row_temp boolean;
  row_locked_until timestamptz;
  row_failed int;
  espera interval;
begin
  if ip <> 'unknown' and seg_contar('pin_fallo', ip, interval '1 hour') >= 30 then
    return query select 'locked'::text, null::text, null::text, null::boolean, (now() + interval '1 hour');
    return;
  end if;

  select e.id, e.pin_hash, e.nombre, e.pin_is_temporary, e.locked_until, e.failed_attempts
  into row_id, row_hash, row_nombre, row_temp, row_locked_until, row_failed
  from employees e
  where e.numero_empleado = p_numero;

  if row_id is null or row_hash is null then
    return query select 'not_found'::text, null::text, null::text, null::boolean, null::timestamptz;
    return;
  end if;

  if row_locked_until is not null and row_locked_until > now() then
    return query select 'locked'::text, null::text, null::text, null::boolean, row_locked_until;
    return;
  end if;

  if row_hash = crypt(coalesce(p_pin, ''), row_hash) then
    update employees set failed_attempts = 0, locked_until = null where id = row_id;
    return query select 'ok'::text, p_numero, row_nombre, row_temp, null::timestamptz;
    return;
  end if;

  row_failed := row_failed + 1;
  espera := pin_espera(row_failed);
  update employees
  set failed_attempts = row_failed, locked_until = case when espera is null then null else now() + espera end
  where id = row_id;
  if ip <> 'unknown' then
    perform seg_anotar('pin_fallo', ip);
  end if;

  if espera is not null then
    return query select 'locked'::text, null::text, null::text, null::boolean, now() + espera;
  else
    return query select 'wrong_pin'::text, null::text, null::text, null::boolean, null::timestamptz;
  end if;
end;
$$;

-- change_pin: same lockout (it also checks a PIN) and no trivial new PIN.
-- Returns 'ok' | 'wrong_pin' | 'locked' | 'not_found' | 'weak_pin'.
create or replace function change_pin(p_numero text, p_old_pin text, p_new_pin text)
returns table(status text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v record;
begin
  select * into v from verify_pin(p_numero, p_old_pin);
  if v.status <> 'ok' then
    return query select v.status;
    return;
  end if;
  if pin_debil(p_new_pin) then
    return query select 'weak_pin'::text;
    return;
  end if;

  update employees
  set pin_hash = crypt(p_new_pin, gen_salt('bf')), failed_attempts = 0, locked_until = null, pin_is_temporary = false
  where employees.numero_empleado = p_numero;

  return query select 'ok'::text;
end;
$$;

-- First PIN. Raises employee_not_found | pin_already_set | weak_pin |
-- rh_asigna_pin (puesto with permissions) | rate_limited.
create or replace function set_initial_pin(p_numero text, p_pin text)
returns table(numero_empleado text, nombre text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  ip text := cliente_ip();
  found_id uuid;
  existing_hash text;
  emp_puesto text;
begin
  if pin_debil(p_pin) then
    raise exception 'weak_pin';
  end if;

  select e.id, e.pin_hash, e.puesto into found_id, existing_hash, emp_puesto
  from employees e where e.numero_empleado = p_numero;

  if found_id is null then
    raise exception 'employee_not_found';
  end if;
  if existing_hash is not null then
    raise exception 'pin_already_set';
  end if;
  if puesto_con_permisos(emp_puesto) then
    raise exception 'rh_asigna_pin';
  end if;
  if seg_contar('registro', 'global', interval '1 hour') >= 60
     or (ip <> 'unknown' and seg_contar('registro', ip, interval '1 hour') >= 10) then
    raise exception 'rate_limited';
  end if;

  perform seg_anotar('registro', 'global');
  if ip <> 'unknown' then
    perform seg_anotar('registro', ip);
  end if;

  return query
  update employees as e
  set pin_hash = crypt(p_pin, gen_salt('bf')), pin_is_temporary = false, failed_attempts = 0, locked_until = null
  where e.id = found_id
  returning e.numero_empleado, e.nombre;
end;
$$;

-- employee_lookup: same as migration 24, with the caller's address from cliente_ip().
create or replace function employee_lookup(p_numero text)
returns table(nombre text, has_pin boolean, tienda text, plaza text, asesor text, puesto text, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  client_ip text := cliente_ip();
  recent_count int;
begin
  delete from lookup_attempts where attempted_at < now() - interval '1 hour';

  select count(*) into recent_count
  from lookup_attempts
  where ip = client_ip and attempted_at > now() - interval '1 minute';

  if client_ip <> 'unknown' and recent_count >= 20 then
    raise exception 'rate_limited';
  end if;

  insert into lookup_attempts (ip) values (client_ip);

  return query
  select e.nombre, (e.pin_hash is not null), e.tienda, e.plaza, e.asesor, e.puesto, e.created_at
  from employees e
  where e.numero_empleado = p_numero;
end;
$$;

-- === Admin panel with the session key (replaces the RH passcode) ===
-- Employee number of a valid key whose puesto manages employees and PINs,
-- or the status: 'no_session' | 'not_allowed'.
create or replace function sesion_personal(p_token text, out numero text, out estado text)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  numero := sesion_empleado(p_token);
  if numero is null then
    estado := 'no_session';
  elsif not puesto_gestiona_personal((select e.puesto from employees e where e.numero_empleado = numero)) then
    estado := 'not_allowed';
  else
    estado := 'ok';
  end if;
end;
$$;

-- What the signed-in employee can do in the panel.
create or replace function sesion_panel(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  numero text := sesion_empleado(p_token);
  emp record;
begin
  if numero is null then
    return jsonb_build_object('estado', 'no_session');
  end if;
  select e.nombre, e.puesto into emp from employees e where e.numero_empleado = numero;
  return jsonb_build_object(
    'estado', 'ok',
    'nombre', emp.nombre,
    'avisos', voto_puede_administrar(emp.puesto),
    'personal', puesto_gestiona_personal(emp.puesto));
end;
$$;

create or replace function sesion_listar_empleados(p_token text, p_buscar text default '')
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  adm record;
  b text := trim(coalesce(p_buscar, ''));
begin
  select * into adm from sesion_personal(p_token);
  if adm.estado <> 'ok' then
    return jsonb_build_object('estado', adm.estado);
  end if;
  return jsonb_build_object('estado', 'ok', 'empleados', coalesce((
    select jsonb_agg(jsonb_build_object(
      'numero', e.numero_empleado, 'nombre', e.nombre, 'tienda', e.tienda, 'puesto', e.puesto,
      'tiene_pin', e.pin_hash is not null, 'temporal', e.pin_is_temporary,
      'bloqueado', e.locked_until is not null and e.locked_until > now()) order by e.nombre)
    from (
      select * from employees e
      where b = '' or e.numero_empleado ilike '%' || b || '%' or e.nombre ilike '%' || b || '%'
      order by e.nombre
      limit 50
    ) e
  ), '[]'::jsonb));
end;
$$;

-- New employee with a temporary PIN (shown once to RH).
create or replace function sesion_agregar_empleado(
  p_token text, p_numero text, p_nombre text, p_tienda text, p_plaza text, p_asesor text, p_puesto text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  adm record;
  nuevo_pin text := pin_aleatorio();
begin
  select * into adm from sesion_personal(p_token);
  if adm.estado <> 'ok' then
    return jsonb_build_object('estado', adm.estado);
  end if;
  if trim(coalesce(p_numero, '')) !~ '^[0-9]{3,10}$' or char_length(trim(coalesce(p_nombre, ''))) < 3 then
    return jsonb_build_object('estado', 'datos_invalidos');
  end if;
  if exists (select 1 from employees e where e.numero_empleado = trim(p_numero)) then
    return jsonb_build_object('estado', 'ya_existe');
  end if;
  insert into employees (numero_empleado, nombre, tienda, plaza, asesor, puesto, pin_hash, pin_is_temporary)
  values (trim(p_numero), trim(p_nombre), nullif(trim(coalesce(p_tienda, '')), ''), nullif(trim(coalesce(p_plaza, '')), ''),
          nullif(trim(coalesce(p_asesor, '')), ''), nullif(trim(coalesce(p_puesto, '')), ''), crypt(nuevo_pin, gen_salt('bf')), true);
  return jsonb_build_object('estado', 'ok', 'pin_temporal', nuevo_pin);
end;
$$;

-- Temporary PIN for an employee (forgotten PIN, or a puesto with permissions
-- that cannot self-register). Clears the lockout; ends their sessions.
create or replace function sesion_reiniciar_pin(p_token text, p_numero text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  adm record;
  nuevo_pin text := pin_aleatorio();
begin
  select * into adm from sesion_personal(p_token);
  if adm.estado <> 'ok' then
    return jsonb_build_object('estado', adm.estado);
  end if;
  update employees
  set pin_hash = crypt(nuevo_pin, gen_salt('bf')), pin_is_temporary = true, failed_attempts = 0, locked_until = null
  where numero_empleado = p_numero;
  if not found then
    return jsonb_build_object('estado', 'not_found');
  end if;
  return jsonb_build_object('estado', 'ok', 'pin_temporal', nuevo_pin);
end;
$$;

-- Directory (same puestos as avisos).
create or replace function sesion_guardar_contacto(
  p_token text, p_id uuid, p_name text, p_area text, p_role text, p_phone text, p_schedule text, p_tags text[], p_urgent boolean
)
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
  if char_length(trim(coalesce(p_name, ''))) < 2 or char_length(trim(coalesce(p_phone, ''))) < 7 then
    return 'datos_invalidos';
  end if;
  if p_id is null then
    insert into directory_contacts (name, area, role, phone, schedule, tags, urgent)
    values (trim(p_name), trim(coalesce(p_area, '')), trim(coalesce(p_role, '')), trim(p_phone), trim(coalesce(p_schedule, '')),
            coalesce(p_tags, '{}'), coalesce(p_urgent, false));
  else
    update directory_contacts
    set name = trim(p_name), area = trim(coalesce(p_area, '')), role = trim(coalesce(p_role, '')), phone = trim(p_phone),
        schedule = trim(coalesce(p_schedule, '')), tags = coalesce(p_tags, '{}'), urgent = coalesce(p_urgent, false)
    where id = p_id;
  end if;
  return 'ok';
end;
$$;

create or replace function sesion_borrar_contacto(p_token text, p_id uuid)
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
  delete from directory_contacts where id = p_id;
  return 'ok';
end;
$$;

-- === Retire the RH passcode ===
drop function if exists create_notice(text, text, text, text, boolean);
drop function if exists admin_list_employees(text, text);
drop function if exists admin_add_employee(text, text, text, text, text, text);
drop function if exists admin_reset_pin(text, text);
drop function if exists admin_delete_notice(text, uuid);
drop function if exists admin_upsert_contact(text, text, text, text, text, text, text, text[], boolean);
drop function if exists admin_delete_contact(text, uuid);
drop function if exists admin_check_passcode(text);
drop table if exists admin_settings;

-- === Grants ===
revoke execute on function cliente_ip() from public, anon, authenticated;
revoke execute on function seg_contar(text, text, interval) from public, anon, authenticated;
revoke execute on function seg_anotar(text, text) from public, anon, authenticated;
revoke execute on function pin_aleatorio() from public, anon, authenticated;
revoke execute on function sesion_personal(text) from public, anon, authenticated;
grant execute on function mi_red() to anon, authenticated;
grant execute on function verify_pin(text, text) to anon, authenticated;
grant execute on function change_pin(text, text, text) to anon, authenticated;
grant execute on function set_initial_pin(text, text) to anon, authenticated;
grant execute on function employee_lookup(text) to anon, authenticated;
grant execute on function sesion_panel(text) to anon, authenticated;
grant execute on function sesion_listar_empleados(text, text) to anon, authenticated;
grant execute on function sesion_agregar_empleado(text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function sesion_reiniciar_pin(text, text) to anon, authenticated;
grant execute on function sesion_guardar_contacto(text, uuid, text, text, text, text, text, text[], boolean) to anon, authenticated;
grant execute on function sesion_borrar_contacto(text, uuid) to anon, authenticated;

NOTIFY pgrst, 'reload schema';
