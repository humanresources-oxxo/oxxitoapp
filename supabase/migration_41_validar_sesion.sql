-- Migration 41: lets the DashboardsOxxo Apps Script check a Conoxxo session
-- key (audit, step 2). Run once in Supabase SQL Editor, after migration 40.
--
-- The app sends its session key with the Apps Script requests for CCT,
-- DILOS and actas; the script asks sesion_validar who it belongs to and
-- whether that puesto has permissions (puesto_con_permisos, the same list
-- as PUESTOS_ACTAS in the app). Without a valid key it answers nothing
-- else, so it reveals nothing to someone without a key.

create or replace function sesion_validar(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  numero text := sesion_empleado(p_token);
  emp record;
begin
  if numero is null then
    return jsonb_build_object('estado', 'no_session');
  end if;
  select e.nombre, e.puesto into emp from employees e where e.numero_empleado = numero;
  return jsonb_build_object(
    'estado', 'ok',
    'numero', numero,
    'nombre', emp.nombre,
    'puesto', emp.puesto,
    'permisos', puesto_con_permisos(emp.puesto));
end;
$$;

grant execute on function sesion_validar(text) to anon, authenticated;

NOTIFY pgrst, 'reload schema';
