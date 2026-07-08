-- Migration 13: email verification before first-time PIN creation, so
-- someone else can't create a PIN for a roster employee who hasn't set
-- theirs up yet. Uses Resend (via pg_net, no separate Edge Function needed)
-- to send a 6-digit code the employee types back before creating their PIN.

create extension if not exists pg_net;

-- Plaintext app secrets (API keys etc). Only readable from inside
-- security-definer functions — never granted to anon/authenticated directly.
create table if not exists app_secrets (
  key text primary key,
  value text not null
);

alter table app_secrets enable row level security;

insert into app_secrets (key, value)
values ('resend_api_key', 'REPLACE_WITH_REAL_RESEND_KEY')
on conflict (key) do update set value = excluded.value;

create table if not exists email_verifications (
  id bigserial primary key,
  numero_empleado text not null,
  email text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  created_at timestamptz not null default now()
);

alter table email_verifications enable row level security;
create index if not exists email_verifications_numero_idx on email_verifications (numero_empleado, created_at desc);

alter table employees add column if not exists pending_email_verified_until timestamptz;

-- Request a 6-digit code by email. Only for employees who don't have a PIN
-- yet (that's the only time identity verification matters here).
create or replace function request_email_code(p_numero text, p_email text)
returns table(status text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  row_id uuid;
  row_pin_hash text;
  recent_count int;
  code text;
  resend_key text;
begin
  select e.id, e.pin_hash into row_id, row_pin_hash from employees e where e.numero_empleado = p_numero;

  if row_id is null then
    return query select 'not_found'::text;
    return;
  end if;

  if row_pin_hash is not null then
    return query select 'already_has_pin'::text;
    return;
  end if;

  select count(*) into recent_count
  from email_verifications
  where numero_empleado = p_numero and created_at > now() - interval '10 minutes';

  if recent_count >= 3 then
    return query select 'rate_limited'::text;
    return;
  end if;

  code := lpad(floor(random() * 1000000)::text, 6, '0');

  insert into email_verifications (numero_empleado, email, code_hash, expires_at)
  values (p_numero, p_email, crypt(code, gen_salt('bf')), now() + interval '10 minutes');

  select value into resend_key from app_secrets where key = 'resend_api_key';

  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object('Authorization', 'Bearer ' || resend_key, 'Content-Type', 'application/json'),
    body := jsonb_build_object(
      'from', 'Oxxito <onboarding@resend.dev>',
      'to', array[p_email],
      'subject', 'Tu codigo de verificacion Oxxito',
      'html', '<p>Tu codigo de verificacion es:</p><h2 style="letter-spacing:4px">' || code || '</h2><p>Vence en 10 minutos.</p>'
    )
  );

  return query select 'sent'::text;
end;
$$;

-- Verify the code; on success, opens a 15-minute window to create the PIN.
create or replace function verify_email_code(p_numero text, p_email text, p_code text)
returns table(status text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  row_id uuid;
  ver_id bigint;
  ver_hash text;
  ver_expires timestamptz;
  ver_attempts int;
begin
  select e.id into row_id from employees e where e.numero_empleado = p_numero;
  if row_id is null then
    return query select 'not_found'::text;
    return;
  end if;

  select id, code_hash, expires_at, attempts into ver_id, ver_hash, ver_expires, ver_attempts
  from email_verifications
  where numero_empleado = p_numero and email = p_email
  order by created_at desc
  limit 1;

  if ver_id is null then
    return query select 'not_found'::text;
    return;
  end if;

  if ver_expires < now() then
    return query select 'expired'::text;
    return;
  end if;

  if ver_attempts >= 5 then
    return query select 'too_many_attempts'::text;
    return;
  end if;

  if ver_hash <> crypt(p_code, ver_hash) then
    update email_verifications set attempts = attempts + 1 where id = ver_id;
    return query select 'wrong_code'::text;
    return;
  end if;

  update employees set pending_email_verified_until = now() + interval '15 minutes' where id = row_id;
  delete from email_verifications where numero_empleado = p_numero;

  return query select 'ok'::text;
end;
$$;

-- set_initial_pin now requires a recent successful email verification.
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
  verified_until timestamptz;
begin
  select e.id, e.pin_hash, e.pending_email_verified_until
  into found_id, existing_hash, verified_until
  from employees e where e.numero_empleado = p_numero;

  if found_id is null then
    raise exception 'employee_not_found';
  end if;

  if existing_hash is not null then
    raise exception 'pin_already_set';
  end if;

  if verified_until is null or verified_until < now() then
    raise exception 'email_not_verified';
  end if;

  return query
  update employees as e
  set pin_hash = crypt(p_pin, gen_salt('bf')), pending_email_verified_until = null
  where e.id = found_id
  returning e.numero_empleado, e.nombre;
end;
$$;

grant execute on function request_email_code(text, text) to anon, authenticated;
grant execute on function verify_email_code(text, text, text) to anon, authenticated;
grant execute on function set_initial_pin(text, text) to anon, authenticated;

NOTIFY pgrst, 'reload schema';
