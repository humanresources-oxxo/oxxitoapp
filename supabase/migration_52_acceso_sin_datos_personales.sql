-- Migration 52: an employee number alone no longer returns personal data.
-- Run once in Supabase SQL Editor, after 51 and BEFORE publishing the app
-- version that uses it.
--
-- employee_lookup(numero) answered, to the public key and without a session,
-- the full name, tienda, plaza, asesor, puesto and start date of whoever has
-- that number. Its limit (20 per minute per address) slows down someone going
-- through the numbers one by one, but does not stop them.
--
-- This migration only ADDS what replaces it; employee_lookup keeps working
-- for the app already published and is closed in
-- migration_53_cerrar_employee_lookup.sql.
--
--   acceso_empleado(numero)                 public, for the login screen: only
--     what it needs to know where to go next (does the number exist, does it
--     have a PIN, does the first registration ask for the birth date) and the
--     first name for the "Hola, ..." greeting. Same limit as before.
--   sesion_mi_perfil(llave)                 one's own data, with the session
--     key: what the app saves at login and refreshes on every open.
--   sesion_buscar_empleado(llave, numero)   another employee's name, puesto
--     and tienda, only for puestos with permisos (the ones that fill in an
--     acta administrativa and look the worker up by number).

begin;

create or replace function acceso_empleado(p_numero text)
returns table(primer_nombre text, has_pin boolean, pide_fecha boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  client_ip text := cliente_ip();
  recent_count int;
begin
  -- Shares the count with employee_lookup while both exist.
  delete from lookup_attempts where attempted_at < now() - interval '1 hour';

  select count(*) into recent_count
  from lookup_attempts
  where ip = client_ip and attempted_at > now() - interval '1 minute';

  if client_ip <> 'unknown' and recent_count >= 20 then
    raise exception 'rate_limited';
  end if;

  insert into lookup_attempts (ip) values (client_ip);

  return query
  select split_part(trim(e.nombre), ' ', 1), (e.pin_hash is not null), (e.fecha_nacimiento is not null)
  from employees e
  where e.numero_empleado = p_numero;
end;
$$;

-- { estado: 'ok', numero, nombre, tienda, plaza, asesor, puesto, created_at }
-- or { estado: 'no_session' }.
create or replace function sesion_mi_perfil(p_token text)
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
  select e.nombre, e.tienda, e.plaza, e.asesor, e.puesto, e.created_at into emp
  from employees e where e.numero_empleado = numero;
  return jsonb_build_object(
    'estado', 'ok',
    'numero', numero,
    'nombre', emp.nombre,
    'tienda', emp.tienda,
    'plaza', emp.plaza,
    'asesor', emp.asesor,
    'puesto', emp.puesto,
    'created_at', emp.created_at);
end;
$$;

-- { estado: 'ok', nombre, puesto, tienda } | 'not_found' | 'not_allowed' |
-- 'no_session'.
create or replace function sesion_buscar_empleado(p_token text, p_numero text)
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
  if not coalesce((select puesto_con_permisos(e.puesto) from employees e where e.numero_empleado = numero), false) then
    return jsonb_build_object('estado', 'not_allowed');
  end if;
  select e.nombre, e.puesto, e.tienda into emp from employees e where e.numero_empleado = trim(p_numero);
  if not found then
    return jsonb_build_object('estado', 'not_found');
  end if;
  return jsonb_build_object('estado', 'ok', 'nombre', emp.nombre, 'puesto', emp.puesto, 'tienda', emp.tienda);
end;
$$;

grant execute on function acceso_empleado(text) to anon, authenticated;
grant execute on function sesion_mi_perfil(text) to anon, authenticated;
grant execute on function sesion_buscar_empleado(text, text) to anon, authenticated;

commit;

NOTIFY pgrst, 'reload schema';
