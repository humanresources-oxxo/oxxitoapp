-- Migration 09: temporary PINs. Every roster employee gets a random PIN
-- generated up front (distributed by RH out-of-band); first login with it
-- forces the employee to set their own definitive PIN before continuing.

alter table employees add column if not exists pin_is_temporary boolean not null default false;

drop function if exists verify_pin(text, text);

create or replace function verify_pin(p_numero text, p_pin text)
returns table(status text, numero_empleado text, nombre text, pin_is_temporary boolean, locked_until timestamptz)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  row_id uuid;
  row_hash text;
  row_nombre text;
  row_temp boolean;
  row_locked_until timestamptz;
  row_failed int;
  matches boolean;
begin
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

  matches := row_hash = crypt(p_pin, row_hash);

  if matches then
    update employees set failed_attempts = 0, locked_until = null where id = row_id;
    return query select 'ok'::text, p_numero, row_nombre, row_temp, null::timestamptz;
    return;
  end if;

  row_failed := row_failed + 1;
  if row_failed >= 5 then
    update employees set failed_attempts = row_failed, locked_until = now() + interval '15 minutes' where id = row_id;
    return query select 'locked'::text, null::text, null::text, null::boolean, (now() + interval '15 minutes');
    return;
  end if;

  update employees set failed_attempts = row_failed where id = row_id;
  return query select 'wrong_pin'::text, null::text, null::text, null::boolean, null::timestamptz;
end;
$$;

grant execute on function verify_pin(text, text) to anon, authenticated;

-- change_pin now also clears the temporary flag whenever a PIN is (re)set.
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
  set pin_hash = crypt(p_new_pin, gen_salt('bf')), failed_attempts = 0, locked_until = null, pin_is_temporary = false
  where id = row_id;

  return query select 'ok'::text;
end;
$$;

grant execute on function change_pin(text, text, text) to anon, authenticated;

-- Service-role-only helper: assigns a random temp PIN to every roster
-- employee that doesn't have one yet, and returns the plaintext list so it
-- can be distributed to employees. Not granted to anon/authenticated.
create or replace function generate_temp_pins()
returns table(numero_empleado text, nombre text, tienda text, temp_pin text)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  return query
  with pins as (
    select e.id, lpad(floor(random() * 10000)::text, 4, '0') as pin
    from employees e
    where e.pin_hash is null
  )
  update employees e
  set pin_hash = crypt(p.pin, gen_salt('bf')), pin_is_temporary = true
  from pins p
  where e.id = p.id
  returning e.numero_empleado, e.nombre, e.tienda, p.pin;
end;
$$;

NOTIFY pgrst, 'reload schema';
