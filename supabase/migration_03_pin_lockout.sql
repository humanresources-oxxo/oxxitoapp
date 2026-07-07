-- Migration 03: rate-limit PIN attempts (5 tries, then 15 min lockout).
-- Run once in Supabase SQL Editor after migration_02_roster.sql.

alter table employees add column if not exists failed_attempts int not null default 0;
alter table employees add column if not exists locked_until timestamptz;

drop function if exists verify_pin(text, text);

-- Returns status: 'ok' | 'wrong_pin' | 'locked' | 'not_found'.
-- Always returns exactly one row so the client can branch on `status`.
create or replace function verify_pin(p_numero text, p_pin text)
returns table(status text, numero_empleado text, nombre text, locked_until timestamptz)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  row_id uuid;
  row_hash text;
  row_nombre text;
  row_locked_until timestamptz;
  row_failed int;
  matches boolean;
begin
  select e.id, e.pin_hash, e.nombre, e.locked_until, e.failed_attempts
  into row_id, row_hash, row_nombre, row_locked_until, row_failed
  from employees e
  where e.numero_empleado = p_numero;

  if row_id is null or row_hash is null then
    return query select 'not_found'::text, null::text, null::text, null::timestamptz;
    return;
  end if;

  if row_locked_until is not null and row_locked_until > now() then
    return query select 'locked'::text, null::text, null::text, row_locked_until;
    return;
  end if;

  matches := row_hash = crypt(p_pin, row_hash);

  if matches then
    update employees set failed_attempts = 0, locked_until = null where id = row_id;
    return query select 'ok'::text, p_numero, row_nombre, null::timestamptz;
    return;
  end if;

  row_failed := row_failed + 1;
  if row_failed >= 5 then
    update employees set failed_attempts = row_failed, locked_until = now() + interval '15 minutes' where id = row_id;
    return query select 'locked'::text, null::text, null::text, (now() + interval '15 minutes');
    return;
  end if;

  update employees set failed_attempts = row_failed where id = row_id;
  return query select 'wrong_pin'::text, null::text, null::text, null::timestamptz;
end;
$$;

grant execute on function verify_pin(text, text) to anon, authenticated;

NOTIFY pgrst, 'reload schema';
