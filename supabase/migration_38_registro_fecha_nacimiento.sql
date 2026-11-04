-- Migration 38: the first registration asks for the birth date. Run once in
-- Supabase SQL Editor, after migration 37.
--
-- Until now anyone who knew an employee number of someone without a PIN
-- could create that PIN and take the account. Now registrar_pin also needs
-- the employee's birth date, which RH loads from the admin panel
-- (Empleados → Fechas de nacimiento) and which never leaves the database
-- (no function returns it). After 5 wrong dates an account takes no more
-- registration tries for 24 h (20 per hour per address); employees without
-- a loaded date get their first PIN from RH (temporary PIN).
-- set_initial_pin (number + PIN only) is dropped; mi_red() (diagnostic of
-- migration 37) too.

alter table employees add column if not exists fecha_nacimiento date;

-- Returns 'ok' | 'not_found' | 'pin_already_set' | 'weak_pin' |
-- 'rh_asigna_pin' | 'sin_fecha' | 'fecha_incorrecta' | 'rate_limited'.
-- Statuses instead of errors so failed tries are recorded.
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

  if emp.fecha_nacimiento is null then
    return 'sin_fecha';
  end if;

  begin
    if coalesce(p_fecha, '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      fecha := p_fecha::date;
    end if;
  exception when others then
    fecha := null;
  end;

  if fecha is null or fecha <> emp.fecha_nacimiento then
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
  set pin_hash = crypt(p_pin, gen_salt('bf')), pin_is_temporary = false, failed_attempts = 0, locked_until = null
  where id = emp.id;
  return 'ok';
end;
$$;

-- RH loads birth dates: p_filas = [{numero, fecha: 'YYYY-MM-DD'}].
-- Returns {estado, actualizados, no_encontrados: [...], invalidas: [...]}.
create or replace function sesion_cargar_fechas(p_token text, p_filas jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  adm record;
  fila jsonb;
  numero text;
  fecha date;
  actualizados int := 0;
  no_encontrados text[] := '{}';
  invalidas text[] := '{}';
begin
  select * into adm from sesion_personal(p_token);
  if adm.estado <> 'ok' then
    return jsonb_build_object('estado', adm.estado);
  end if;
  if jsonb_typeof(p_filas) <> 'array' or jsonb_array_length(p_filas) > 2000 then
    return jsonb_build_object('estado', 'datos_invalidos');
  end if;

  for fila in select * from jsonb_array_elements(p_filas) loop
    numero := trim(coalesce(fila ->> 'numero', ''));
    fecha := null;
    begin
      if coalesce(fila ->> 'fecha', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
        fecha := (fila ->> 'fecha')::date;
      end if;
    exception when others then
      fecha := null;
    end;
    if numero = '' or fecha is null or fecha < date '1930-01-01' or fecha > current_date - interval '14 years' then
      invalidas := invalidas || numero;
      continue;
    end if;
    update employees set fecha_nacimiento = fecha where numero_empleado = numero;
    if found then
      actualizados := actualizados + 1;
    else
      no_encontrados := no_encontrados || numero;
    end if;
  end loop;

  return jsonb_build_object('estado', 'ok', 'actualizados', actualizados,
    'no_encontrados', to_jsonb(no_encontrados[1:50]), 'n_no_encontrados', cardinality(no_encontrados),
    'invalidas', to_jsonb(invalidas[1:50]), 'n_invalidas', cardinality(invalidas));
end;
$$;

-- Employee list for the panel: adds whether the birth date is loaded (the
-- date itself is never returned) and how many have none.
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
        'tiene_fecha', e.fecha_nacimiento is not null) order by e.nombre)
      from (
        select * from employees e
        where b = '' or e.numero_empleado ilike '%' || b || '%' or e.nombre ilike '%' || b || '%'
        order by e.nombre
        limit 50
      ) e
    ), '[]'::jsonb));
end;
$$;

drop function if exists set_initial_pin(text, text);
drop function if exists mi_red();

grant execute on function registrar_pin(text, text, text) to anon, authenticated;
grant execute on function sesion_cargar_fechas(text, jsonb) to anon, authenticated;
grant execute on function sesion_listar_empleados(text, text) to anon, authenticated;

NOTIFY pgrst, 'reload schema';
