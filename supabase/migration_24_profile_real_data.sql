-- Migration 24: Profile screen shows hardcoded fake data ("Colaborador de
-- tienda", "Mar 2024") as fallback instead of the real puesto (loaded for 22
-- employees) and real signup date. Expose both from employee_lookup.

drop function if exists employee_lookup(text);

create or replace function employee_lookup(p_numero text)
returns table(nombre text, has_pin boolean, tienda text, plaza text, asesor text, puesto text, created_at timestamptz)
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
  select e.nombre, (e.pin_hash is not null), e.tienda, e.plaza, e.asesor, e.puesto, e.created_at
  from employees e
  where e.numero_empleado = p_numero;
end;
$$;

grant execute on function employee_lookup(text) to anon, authenticated;

NOTIFY pgrst, 'reload schema';
