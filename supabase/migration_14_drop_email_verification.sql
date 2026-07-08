-- Migration 14: revert email verification — Resend's sandbox domain can only
-- send to the account owner's own address, so it never worked for real
-- employees without a verified domain (which isn't available right now).
-- Back to: first login just needs the employee number to create a PIN.

drop function if exists debug_net_response();
drop function if exists request_email_code(text, text);
drop function if exists verify_email_code(text, text, text);
drop table if exists email_verifications;
drop table if exists app_secrets;

alter table employees drop column if exists pending_email_verified_until;

drop function if exists set_initial_pin(text, text);
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

grant execute on function set_initial_pin(text, text) to anon, authenticated;

NOTIFY pgrst, 'reload schema';
