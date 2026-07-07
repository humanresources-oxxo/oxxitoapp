-- Migration 02: real employee roster (nómina real) + "solo crea tu PIN" flow.
-- Run once in Supabase SQL Editor after migration 01 (schema.sql) is applied.

-- Employees are now pre-loaded from the real roster; PIN is set on first login,
-- not at signup time, so it must be nullable until then.
alter table employees alter column pin_hash drop not null;
alter table employees add column if not exists plaza text;
alter table employees add column if not exists tienda text;
alter table employees add column if not exists cr_tienda text;
alter table employees add column if not exists asesor text;

-- Free-form self-registration is gone: only employees present in the real
-- roster (pre-loaded via seed_employees.js) can create a PIN.
drop function if exists register_employee(text, text, text);

-- Look up an employee by number: tells Login whether the number exists, and
-- whether they still need to create their PIN (first login) or verify it.
-- The return shape changed (added has_pin/tienda/plaza/asesor), so the old
-- single-column version must be dropped first.
drop function if exists employee_lookup(text);
create or replace function employee_lookup(p_numero text)
returns table(nombre text, has_pin boolean, tienda text, plaza text, asesor text)
language sql
security definer
set search_path = public
as $$
  select e.nombre, (e.pin_hash is not null), e.tienda, e.plaza, e.asesor
  from employees e
  where e.numero_empleado = p_numero;
$$;

-- First-login PIN creation. Only works once (fails if a PIN is already set),
-- and only for a number that's already in the roster.
create or replace function set_initial_pin(p_numero text, p_pin text)
returns table(numero_empleado text, nombre text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  found_id uuid;
  existing_hash text;
begin
  select e.id, e.pin_hash into found_id, existing_hash
  from employees e where e.numero_empleado = p_numero;

  if found_id is null then
    raise exception 'employee_not_found';
  end if;

  if existing_hash is not null then
    raise exception 'pin_already_set';
  end if;

  return query
  update employees as e
  set pin_hash = crypt(p_pin, gen_salt('bf'))
  where e.id = found_id
  returning e.numero_empleado, e.nombre;
end;
$$;

-- Verify PIN: guard against employees that haven't set one yet (pin_hash null).
create or replace function verify_pin(p_numero text, p_pin text)
returns table(numero_empleado text, nombre text)
language sql
security definer
set search_path = public, extensions
as $$
  select numero_empleado, nombre
  from employees
  where numero_empleado = p_numero
    and pin_hash is not null
    and pin_hash = crypt(p_pin, pin_hash);
$$;

grant execute on function employee_lookup(text) to anon, authenticated;
grant execute on function set_initial_pin(text, text) to anon, authenticated;
grant execute on function verify_pin(text, text) to anon, authenticated;

NOTIFY pgrst, 'reload schema';
