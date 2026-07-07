-- Migration 12: undo the bulk temp-PIN rollout — too much overhead to
-- distribute codes for 263 people. Employees without a PIN now just create
-- their own on first login (no code needed), same for admin-added employees
-- and PIN resets.

-- Clear temp PINs that haven't been claimed yet (leaves real, already-chosen
-- PINs untouched — only rows still marked pin_is_temporary get reset).
update employees
set pin_hash = null, pin_is_temporary = false, failed_attempts = 0, locked_until = null
where pin_is_temporary = true;

drop function if exists generate_temp_pins();
drop function if exists admin_add_employee(text, text, text, text, text, text);
drop function if exists admin_reset_pin(text, text);

-- Adding an employee now leaves them with no PIN (they create their own on
-- first login), instead of generating a code to hand out.
create or replace function admin_add_employee(
  p_passcode text,
  p_numero text,
  p_nombre text,
  p_tienda text,
  p_plaza text,
  p_asesor text
)
returns table(numero_empleado text, nombre text)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not admin_check_passcode(p_passcode) then
    raise exception 'invalid_passcode';
  end if;

  if exists (select 1 from employees e where e.numero_empleado = p_numero) then
    raise exception 'employee_already_exists';
  end if;

  return query
  insert into employees as e (numero_empleado, nombre, tienda, plaza, asesor)
  values (p_numero, p_nombre, nullif(p_tienda, ''), nullif(p_plaza, ''), nullif(p_asesor, ''))
  returning e.numero_empleado, e.nombre;
end;
$$;

-- Resetting a PIN now just clears it — the employee creates a new one
-- themselves on their next login, nothing to hand out.
create or replace function admin_reset_pin(p_passcode text, p_numero text)
returns table(numero_empleado text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  row_id uuid;
begin
  if not admin_check_passcode(p_passcode) then
    raise exception 'invalid_passcode';
  end if;

  select e.id into row_id from employees e where e.numero_empleado = p_numero;
  if row_id is null then
    raise exception 'employee_not_found';
  end if;

  update employees
  set pin_hash = null, pin_is_temporary = false, failed_attempts = 0, locked_until = null
  where id = row_id;

  return query select p_numero;
end;
$$;

grant execute on function admin_add_employee(text, text, text, text, text, text) to anon, authenticated;
grant execute on function admin_reset_pin(text, text) to anon, authenticated;

NOTIFY pgrst, 'reload schema';
