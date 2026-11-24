-- Migration 62: the birth date of the first registration is checked right
-- away. Run once in Supabase SQL Editor, after 61.
--
-- Until now the app only moved from the date to the PIN screen; the date was
-- checked at the end together with the PIN (registrar_pin, migration 39). With
-- a wrong date the person created a PIN and only then was sent back, which
-- looked like the wrong date had been accepted.
--
-- registro_verificar_fecha checks just the date, with the SAME limits and the
-- SAME counters as registrar_pin (5 wrong dates per number in 24 h, 20 per IP
-- per hour): asking here does not give more tries. registrar_pin still checks
-- the date again when the PIN is saved.
-- Returns 'ok' | 'fecha_incorrecta' | 'rate_limited' | 'not_found' |
-- 'pin_already_set' | 'rh_asigna_pin'.

begin;

create or replace function registro_verificar_fecha(p_numero text, p_fecha text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  ip text := cliente_ip();
  emp record;
  fecha date;
begin
  select e.id, e.pin_hash, e.puesto, e.fecha_nacimiento into emp
  from employees e where e.numero_empleado = p_numero;
  if emp.id is null then
    return 'not_found';
  end if;
  if emp.pin_hash is not null then
    return 'pin_already_set';
  end if;
  if puesto_con_permisos(emp.puesto) then
    return 'rh_asigna_pin';
  end if;

  if seg_contar('registro_fallo', p_numero, interval '24 hours') >= 5
     or (ip <> 'unknown' and seg_contar('registro_fallo_ip', ip, interval '1 hour') >= 20) then
    return 'rate_limited';
  end if;

  begin
    if coalesce(p_fecha, '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      fecha := p_fecha::date;
    end if;
  exception when others then
    fecha := null;
  end;

  if emp.fecha_nacimiento is not null and (fecha is null or fecha <> emp.fecha_nacimiento) then
    perform seg_anotar('registro_fallo', p_numero);
    if ip <> 'unknown' then
      perform seg_anotar('registro_fallo_ip', ip);
    end if;
    return 'fecha_incorrecta';
  end if;
  return 'ok';
end;
$$;

grant execute on function registro_verificar_fecha(text, text) to anon, authenticated;

commit;

NOTIFY pgrst, 'reload schema';
