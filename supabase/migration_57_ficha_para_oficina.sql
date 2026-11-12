-- Migration 57: the Ficha de Plaza (pestaña Resumen) and its chatbot for every
-- office puesto. Run once in Supabase SQL Editor, after 56.
--
-- Until now only the puestos in puesto_con_permisos (Asesor tienda, RH,
-- Gerente plaza, Analista experiencia colaborador, Practicante, Sindicato) saw
-- the Ficha. RH asked (2026-11-12) to open it to every office puesto: Asesor
-- TI, Coordinador administrativo, Responsable administrativo, Coordinador
-- ejecución comercial, Recepcionista, Responsable comercial and any new one.
-- Office = a puesto that is set and is not a store puesto (Líder tienda,
-- Encargado turno, Ayudante tienda, satélite included). Store staff have no
-- puesto in the roster today, so they stay out.
--
-- This does NOT widen puesto_con_permisos: actas, Estructura, Cuota sindical,
-- DILOS, CCT and Mi equipo stay as they are. sesion_validar only adds
-- "ficha": true for those who may see the Ficha; the Apps Script (v71) lets
-- them read the sheets the Ficha needs, and the app shows them Resumen.
-- Note: those sheets include the bajas rows (colaborador, motivo, género);
-- the Ficha only shows totals, but the data reaches the phone.

begin;

create or replace function puesto_ve_ficha(p_puesto text)
returns boolean
language sql
immutable
as $$
  select puesto_con_permisos(p_puesto) or (
    nullif(btrim(coalesce(p_puesto, '')), '') is not null
    and not exists (
      select 1
      from unnest(array['LIDER TIENDA', 'ENCARGADO TURNO', 'AYUDANTE TIENDA']) as tienda
      where regexp_replace(upper(translate(btrim(p_puesto), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')), '\s+', ' ', 'g')
        like tienda || '%'
    )
  );
$$;

revoke execute on function puesto_ve_ficha(text) from public, anon, authenticated;

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
    'permisos', puesto_con_permisos(emp.puesto),
    'ficha', puesto_ve_ficha(emp.puesto));
end;
$$;

grant execute on function sesion_validar(text) to anon, authenticated;

-- Who sees the Ficha now (shows in the SQL Editor's result).
select puesto, puesto_con_permisos(puesto) as permisos, puesto_ve_ficha(puesto) as ficha, count(*)
from employees group by 1, 2, 3 order by 3 desc, 1;

commit;

NOTIFY pgrst, 'reload schema';
