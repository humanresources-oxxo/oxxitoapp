-- Migration 07: let an employee change their own PIN (old PIN required),
-- with the same 5-attempt lockout as verify_pin.

create or replace function change_pin(p_numero text, p_old_pin text, p_new_pin text)
returns table(status text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  row_id uuid;
  row_hash text;
  row_locked_until timestamptz;
  row_failed int;
begin
  select e.id, e.pin_hash, e.locked_until, e.failed_attempts
  into row_id, row_hash, row_locked_until, row_failed
  from employees e
  where e.numero_empleado = p_numero;

  if row_id is null or row_hash is null then
    return query select 'not_found'::text;
    return;
  end if;

  if row_locked_until is not null and row_locked_until > now() then
    return query select 'locked'::text;
    return;
  end if;

  if row_hash <> crypt(p_old_pin, row_hash) then
    row_failed := row_failed + 1;
    if row_failed >= 5 then
      update employees set failed_attempts = row_failed, locked_until = now() + interval '15 minutes' where id = row_id;
      return query select 'locked'::text;
    else
      update employees set failed_attempts = row_failed where id = row_id;
      return query select 'wrong_pin'::text;
    end if;
    return;
  end if;

  update employees
  set pin_hash = crypt(p_new_pin, gen_salt('bf')), failed_attempts = 0, locked_until = null
  where id = row_id;

  return query select 'ok'::text;
end;
$$;

grant execute on function change_pin(text, text, text) to anon, authenticated;

NOTIFY pgrst, 'reload schema';
