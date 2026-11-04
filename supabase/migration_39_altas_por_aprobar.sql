-- Migration 39: new accounts wait for approval. Run once in Supabase SQL
-- Editor, after migration 38.
--
-- Someone who knows the employee number of a colleague without an account
-- could register in their place. Now a self-registered account stays
-- "pendiente" (it cannot sign in: verify_pin answers 'pendiente') until the
-- employee's asesor (employees.asesor equals the asesor's name, without
-- accents or case, as the app's Estructura does), RH or the Gerente de plaza
-- approves it in the app (Inicio → Altas por aprobar) or in the admin panel.
-- Rejecting frees the account so the real person can register. Existing
-- accounts and those whose PIN comes from RH (temporary PIN) need nothing.

alter table employees add column if not exists alta_pendiente boolean not null default false;
alter table employees add column if not exists alta_registrada_en timestamptz;
alter table employees add column if not exists alta_aprobada_por text;
alter table employees add column if not exists alta_aprobada_en timestamptz;

-- Same as normalizarNombre in the app (services/gviz.ts).
create or replace function norm_nombre(t text)
returns text
language sql
immutable
as $$
  select trim(regexp_replace(regexp_replace(
    upper(translate(coalesce(t, ''), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')),
    '[^A-Z ]', ' ', 'g'), '\s+', ' ', 'g'));
$$;

-- Whether p_aprobador can approve p_empleado's new account: RH (the puestos
-- that manage PINs) and Gerente de plaza approve anyone; an Asesor de Tienda
-- approves the employees whose roster asesor is them.
create or replace function puede_aprobar_alta(p_aprobador text, p_empleado text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select puesto_gestiona_personal(a.puesto)
      or norm_nombre(a.puesto) like 'GERENTE PLAZA%'
      or (norm_nombre(a.puesto) like 'ASESOR TIENDA%' and norm_nombre(e.asesor) <> '' and norm_nombre(e.asesor) = norm_nombre(a.nombre))
    from employees a, employees e
    where a.numero_empleado = p_aprobador and e.numero_empleado = p_empleado
  ), false);
$$;

-- === verify_pin: pending accounts cannot sign in (rest as migration 37) ===
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
  row_pendiente boolean;
  espera interval;
begin
  if ip <> 'unknown' and seg_contar('pin_fallo', ip, interval '1 hour') >= 30 then
    return query select 'locked'::text, null::text, null::text, null::boolean, (now() + interval '1 hour');
    return;
  end if;

  select e.id, e.pin_hash, e.nombre, e.pin_is_temporary, e.locked_until, e.failed_attempts, e.alta_pendiente
  into row_id, row_hash, row_nombre, row_temp, row_locked_until, row_failed, row_pendiente
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
    -- Self-registered and not approved yet by their asesor / RH (migration 39).
    if row_pendiente then
      return query select 'pendiente'::text, null::text, null::text, null::boolean, null::timestamptz;
      return;
    end if;
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

-- === registrar_pin: the new account waits for approval (rest as migration 38) ===
create or replace function registrar_pin(p_numero text, p_fecha text, p_pin text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  ip text := cliente_ip();
  emp record;
  fecha date;
begin
  if pin_debil(p_pin) then
    return 'weak_pin';
  end if;

  select e.id, e.pin_hash, e.puesto, e.fecha_nacimiento into emp
  from employees e where e.numero_empleado = p_numero;
  if emp.id is null then
    return 'not_found';
  end if;
  if emp.pin_hash is not null then
    return 'pin_already_set';
  end if;
  if puesto_con_permisos(emp.puesto) then
    return 'rh_asigna_pin';
  end if;

  if seg_contar('registro_fallo', p_numero, interval '24 hours') >= 5
     or (ip <> 'unknown' and seg_contar('registro_fallo_ip', ip, interval '1 hour') >= 20)
     or seg_contar('registro', 'global', interval '1 hour') >= 60
     or (ip <> 'unknown' and seg_contar('registro', ip, interval '1 hour') >= 10) then
    return 'rate_limited';
  end if;

  begin
    if coalesce(p_fecha, '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      fecha := p_fecha::date;
    end if;
  exception when others then
    fecha := null;
  end;

  if emp.fecha_nacimiento is not null and (fecha is null or fecha <> emp.fecha_nacimiento) then
    perform seg_anotar('registro_fallo', p_numero);
    if ip <> 'unknown' then
      perform seg_anotar('registro_fallo_ip', ip);
    end if;
    return 'fecha_incorrecta';
  end if;

  perform seg_anotar('registro', 'global');
  if ip <> 'unknown' then
    perform seg_anotar('registro', ip);
  end if;
  update employees
  set pin_hash = crypt(p_pin, gen_salt('bf')), pin_is_temporary = false, failed_attempts = 0, locked_until = null,
      alta_pendiente = true, alta_registrada_en = now(), alta_aprobada_por = null, alta_aprobada_en = null
  where id = emp.id;
  -- The account waits for its asesor / RH (migration 39).
  return 'pendiente';
end;
$$;

-- === Employee list for the panel: also says whether it waits for approval ===
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
  return jsonb_build_object('estado', 'ok',
    'total', (select count(*) from employees),
    'sin_fecha', (select count(*) from employees where fecha_nacimiento is null),
    'empleados', coalesce((
      select jsonb_agg(jsonb_build_object(
        'numero', e.numero_empleado, 'nombre', e.nombre, 'tienda', e.tienda, 'puesto', e.puesto,
        'tiene_pin', e.pin_hash is not null, 'temporal', e.pin_is_temporary,
        'bloqueado', e.locked_until is not null and e.locked_until > now(),
        'tiene_fecha', e.fecha_nacimiento is not null,
        'pendiente', e.alta_pendiente) order by e.nombre)
      from (
        select * from employees e
        where b = '' or e.numero_empleado ilike '%' || b || '%' or e.nombre ilike '%' || b || '%'
        order by e.nombre
        limit 50
      ) e
    ), '[]'::jsonb));
end;
$$;

-- Pending accounts the signed-in employee can approve.
-- Returns {estado, altas: [{numero, nombre, tienda, puesto, registrada_en}]}.
create or replace function sesion_altas_pendientes(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  numero text := sesion_empleado(p_token);
begin
  if numero is null then
    return jsonb_build_object('estado', 'no_session');
  end if;
  return jsonb_build_object('estado', 'ok', 'altas', coalesce((
    select jsonb_agg(jsonb_build_object(
      'numero', e.numero_empleado, 'nombre', e.nombre, 'tienda', e.tienda, 'puesto', e.puesto,
      'registrada_en', e.alta_registrada_en) order by e.alta_registrada_en)
    from employees e
    where e.alta_pendiente and puede_aprobar_alta(numero, e.numero_empleado)
  ), '[]'::jsonb));
end;
$$;

-- Approve (p_aprobar true) or reject a pending account. Rejecting removes the
-- PIN so the real employee can register. Returns 'ok' | 'no_session' |
-- 'not_allowed' | 'not_found'.
create or replace function sesion_resolver_alta(p_token text, p_numero text, p_aprobar boolean)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  numero text := sesion_empleado(p_token);
begin
  if numero is null then
    return 'no_session';
  end if;
  if not exists (select 1 from employees e where e.numero_empleado = p_numero and e.alta_pendiente) then
    return 'not_found';
  end if;
  if not puede_aprobar_alta(numero, p_numero) then
    return 'not_allowed';
  end if;
  if coalesce(p_aprobar, false) then
    update employees
    set alta_pendiente = false, alta_aprobada_por = numero, alta_aprobada_en = now()
    where numero_empleado = p_numero;
  else
    update employees
    set alta_pendiente = false, pin_hash = null, pin_is_temporary = false, failed_attempts = 0, locked_until = null,
        alta_registrada_en = null, alta_aprobada_por = null, alta_aprobada_en = null
    where numero_empleado = p_numero;
    perform seg_anotar('alta_rechazada', p_numero);
  end if;
  return 'ok';
end;
$$;

-- An RH temporary PIN (sesion_reiniciar_pin) also approves the account:
-- RH gave it in person.
create or replace function alta_aprobada_por_rh()
returns trigger
language plpgsql
as $$
begin
  if new.pin_is_temporary and new.pin_hash is not null then
    new.alta_pendiente := false;
  end if;
  return new;
end;
$$;
drop trigger if exists employees_pin_temporal_aprueba on employees;
create trigger employees_pin_temporal_aprueba
  before insert or update of pin_hash, pin_is_temporary on employees
  for each row
  execute function alta_aprobada_por_rh();

revoke execute on function alta_aprobada_por_rh() from public, anon, authenticated;
grant execute on function verify_pin(text, text) to anon, authenticated;
grant execute on function registrar_pin(text, text, text) to anon, authenticated;
grant execute on function sesion_listar_empleados(text, text) to anon, authenticated;
grant execute on function sesion_altas_pendientes(text) to anon, authenticated;
grant execute on function sesion_resolver_alta(text, text, boolean) to anon, authenticated;

NOTIFY pgrst, 'reload schema';
