-- Migration 08: allow people not yet in the uploaded roster to create their
-- own account (name + PIN). Existing roster employees still go through
-- set_initial_pin (name locked, pulled from the roster) as before.

create or replace function register_employee(p_numero text, p_nombre text, p_pin text)
returns table(numero_empleado text, nombre text)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if exists (select 1 from employees e where e.numero_empleado = p_numero) then
    raise exception 'employee_already_exists';
  end if;

  return query
  insert into employees as e (numero_empleado, nombre, pin_hash)
  values (p_numero, p_nombre, crypt(p_pin, gen_salt('bf')))
  returning e.numero_empleado, e.nombre;
end;
$$;

grant execute on function register_employee(text, text, text) to anon, authenticated;

NOTIFY pgrst, 'reload schema';
