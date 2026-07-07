-- Migration 05: rate-limit employee_lookup by IP to stop roster enumeration
-- (anon key + no limit would let anyone scrape all 264 real names by trying
-- every 7-digit number). Also removes the temporary debug_headers() probe.

drop function if exists debug_headers();

create table if not exists lookup_attempts (
  id bigserial primary key,
  ip text not null,
  attempted_at timestamptz not null default now()
);

create index if not exists lookup_attempts_ip_time_idx on lookup_attempts (ip, attempted_at);

drop function if exists employee_lookup(text);

create or replace function employee_lookup(p_numero text)
returns table(nombre text, has_pin boolean, tienda text, plaza text, asesor text)
language plpgsql
security definer
set search_path = public
as $$
declare
  client_ip text;
  recent_count int;
begin
  client_ip := coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', 'unknown');

  delete from lookup_attempts where attempted_at < now() - interval '1 hour';

  select count(*) into recent_count
  from lookup_attempts
  where ip = client_ip and attempted_at > now() - interval '1 minute';

  if recent_count >= 20 then
    raise exception 'rate_limited';
  end if;

  insert into lookup_attempts (ip) values (client_ip);

  return query
  select e.nombre, (e.pin_hash is not null), e.tienda, e.plaza, e.asesor
  from employees e
  where e.numero_empleado = p_numero;
end;
$$;

grant execute on function employee_lookup(text) to anon, authenticated;

NOTIFY pgrst, 'reload schema';
