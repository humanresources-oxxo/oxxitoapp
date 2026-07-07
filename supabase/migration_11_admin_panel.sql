-- Migration 11: admin panel backend.
-- - Directory moves from a hardcoded file into a real table (admin-editable).
-- - Employee management (add / reset PIN / list) and notice deletion, all
--   gated behind the same admin passcode already used for create_notice.

-- === Directory ===
create table if not exists directory_contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  area text not null,
  role text not null,
  phone text not null,
  schedule text not null,
  tags text[] not null default '{}',
  urgent boolean not null default false,
  created_at timestamptz not null default now()
);

alter table directory_contacts enable row level security;

create or replace function list_directory_contacts()
returns table(id text, name text, area text, role text, phone text, schedule text, tags text[], urgent boolean)
language sql
security definer
set search_path = public
as $$
  select c.id::text, c.name, c.area, c.role, c.phone, c.schedule, c.tags, c.urgent
  from directory_contacts c
  order by c.urgent desc, c.name asc;
$$;

grant execute on function list_directory_contacts() to anon, authenticated;

-- Seed the directory table with the contacts that used to live in the app's
-- source code, so the admin panel starts from what's already real.
insert into directory_contacts (name, area, role, phone, schedule, tags, urgent)
values
  ('Angel Barrita', 'Personas', 'Recepcion de Recursos Humanos', '+529512429585', 'Lun a Vie, 9:00 - 18:00', array['recepcion','nomina','contrato','rh'], true),
  ('Lizeth', 'Personas', 'Experiencia Colaborador', '+529511999697', 'Lun a Vie, 9:00 - 18:00', array['experiencia','colaborador','incapacidad','vacaciones','permiso'], false),
  ('Miguel', 'Sistemas', 'Sistemas y soporte de TI', '+529711424458', 'Lun a Vie, 9:00 - 18:00', array['sistemas','ti','app','acceso','tecnico'], false),
  ('Soporte de la App', 'Sistemas', 'Dudas y fallas de la app Oxxito', '+529511817882', 'Lun a Vie, 9:00 - 18:00', array['app','oxxito','soporte','falla','error'], false),
  ('Doctora', 'Salud', 'Servicio medico', '+529512929439', 'Lun a Vie, 9:00 - 18:00', array['salud','incapacidad','accidente','medico'], false),
  ('Michelle', 'Comercial', 'Area comercial', '+529512929440', 'Lun a Vie, 9:00 - 18:00', array['comercial','ventas','promociones'], false)
on conflict do nothing;

-- === Admin helpers (all passcode-gated) ===
create or replace function admin_check_passcode(p_passcode text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  stored_hash text;
begin
  select value_hash into stored_hash from admin_settings where key = 'notices_passcode';
  return stored_hash is not null and stored_hash = crypt(p_passcode, stored_hash);
end;
$$;

create or replace function admin_list_employees(p_passcode text, p_search text default '')
returns table(numero_empleado text, nombre text, tienda text, plaza text, has_pin boolean, pin_is_temporary boolean)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not admin_check_passcode(p_passcode) then
    raise exception 'invalid_passcode';
  end if;

  return query
  select e.numero_empleado, e.nombre, e.tienda, e.plaza, (e.pin_hash is not null), e.pin_is_temporary
  from employees e
  where p_search = '' or e.numero_empleado ilike '%' || p_search || '%' or e.nombre ilike '%' || p_search || '%'
  order by e.nombre asc
  limit 50;
end;
$$;

create or replace function admin_add_employee(
  p_passcode text,
  p_numero text,
  p_nombre text,
  p_tienda text,
  p_plaza text,
  p_asesor text
)
returns table(numero_empleado text, nombre text, temp_pin text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  new_pin text;
begin
  if not admin_check_passcode(p_passcode) then
    raise exception 'invalid_passcode';
  end if;

  if exists (select 1 from employees e where e.numero_empleado = p_numero) then
    raise exception 'employee_already_exists';
  end if;

  new_pin := lpad(floor(random() * 10000)::text, 4, '0');

  return query
  insert into employees as e (numero_empleado, nombre, tienda, plaza, asesor, pin_hash, pin_is_temporary)
  values (p_numero, p_nombre, nullif(p_tienda, ''), nullif(p_plaza, ''), nullif(p_asesor, ''), crypt(new_pin, gen_salt('bf')), true)
  returning e.numero_empleado, e.nombre, new_pin;
end;
$$;

create or replace function admin_reset_pin(p_passcode text, p_numero text)
returns table(numero_empleado text, temp_pin text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  new_pin text;
  row_id uuid;
begin
  if not admin_check_passcode(p_passcode) then
    raise exception 'invalid_passcode';
  end if;

  select e.id into row_id from employees e where e.numero_empleado = p_numero;
  if row_id is null then
    raise exception 'employee_not_found';
  end if;

  new_pin := lpad(floor(random() * 10000)::text, 4, '0');

  update employees
  set pin_hash = crypt(new_pin, gen_salt('bf')), pin_is_temporary = true, failed_attempts = 0, locked_until = null
  where id = row_id;

  return query select p_numero, new_pin;
end;
$$;

create or replace function admin_delete_notice(p_passcode text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not admin_check_passcode(p_passcode) then
    raise exception 'invalid_passcode';
  end if;

  delete from notices where id = p_id;
end;
$$;

create or replace function admin_upsert_contact(
  p_passcode text,
  p_id text,
  p_name text,
  p_area text,
  p_role text,
  p_phone text,
  p_schedule text,
  p_tags text[],
  p_urgent boolean
)
returns table(id text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  result_id uuid;
begin
  if not admin_check_passcode(p_passcode) then
    raise exception 'invalid_passcode';
  end if;

  if p_id is null or p_id = '' then
    insert into directory_contacts (name, area, role, phone, schedule, tags, urgent)
    values (p_name, p_area, p_role, p_phone, p_schedule, p_tags, p_urgent)
    returning directory_contacts.id into result_id;
  else
    update directory_contacts
    set name = p_name, area = p_area, role = p_role, phone = p_phone, schedule = p_schedule, tags = p_tags, urgent = p_urgent
    where directory_contacts.id = p_id::uuid
    returning directory_contacts.id into result_id;
  end if;

  return query select result_id::text;
end;
$$;

create or replace function admin_delete_contact(p_passcode text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not admin_check_passcode(p_passcode) then
    raise exception 'invalid_passcode';
  end if;

  delete from directory_contacts where id = p_id;
end;
$$;

grant execute on function admin_list_employees(text, text) to anon, authenticated;
grant execute on function admin_add_employee(text, text, text, text, text, text) to anon, authenticated;
grant execute on function admin_reset_pin(text, text) to anon, authenticated;
grant execute on function admin_delete_notice(text, uuid) to anon, authenticated;
grant execute on function admin_upsert_contact(text, text, text, text, text, text, text, text[], boolean) to anon, authenticated;
grant execute on function admin_delete_contact(text, uuid) to anon, authenticated;

NOTIFY pgrst, 'reload schema';
