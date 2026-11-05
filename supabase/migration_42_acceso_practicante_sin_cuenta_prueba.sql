-- Migration 42: employee management for one person (not a whole puesto),
-- and the test account goes away. Run once in Supabase SQL Editor, after
-- migration 41. All or nothing: if the safety check fails, nothing changes.
--
-- 1. accesos_especiales: employees who manage employees and PINs in the
--    admin panel (and approve any new account) besides the RH puestos of
--    puesto_gestiona_personal. First one: 5843652 (Practicante who runs the
--    app; other practicantes don't get it).
-- 2. The test account 1599067 ("ACCES TEST") is deleted with its sessions,
--    and "ACCES TEST" leaves every puesto list, so nobody gets full access
--    just by having that puesto in the roster.
-- Safety check: 5843652 must already have an active account (PIN set and
-- not waiting for approval); otherwise deleting the test account would
-- leave nobody able to give PINs. If it fails: sign in to the panel with the
-- test account, give 5843652 a temporary PIN, sign in once with it in the
-- app (it asks for a new PIN), then run this again.

begin;

do $$
begin
  if not exists (
    select 1 from employees
    where numero_empleado = '5843652' and pin_hash is not null and not alta_pendiente
  ) then
    raise exception 'La cuenta 5843652 todavía no tiene PIN activo. Dale un PIN temporal desde el panel con la cuenta de prueba, entra una vez a la app con él y vuelve a correr esta migración. No se cambió nada.';
  end if;
end $$;

create table if not exists accesos_especiales (
  numero_empleado text primary key,
  gestiona_personal boolean not null default false,
  nota text not null default '',
  creado_en timestamptz not null default now()
);
alter table accesos_especiales enable row level security;
-- No policies: only the functions below read it.

insert into accesos_especiales (numero_empleado, gestiona_personal, nota)
values ('5843652', true, 'Practicante a cargo de la app Conoxxo')
on conflict (numero_empleado) do update set gestiona_personal = true;

-- Whether an employee manages employees and PINs: RH puestos, or a person in
-- accesos_especiales.
create or replace function empleado_gestiona_personal(p_numero text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select puesto_gestiona_personal(e.puesto) from employees e where e.numero_empleado = p_numero), false)
    or exists (select 1 from accesos_especiales a where a.numero_empleado = p_numero and a.gestiona_personal);
$$;

-- === Puesto lists without the test account ===
create or replace function puesto_gestiona_personal(p_puesto text)
returns boolean
language sql
immutable
as $$
  select exists (
    select 1
    from unnest(array['RESPONSABLE RECURSOS HUMANOS', 'ANALISTA EXPERIENCIA COLABORADOR']) as permitido
    where regexp_replace(upper(translate(coalesce(p_puesto, ''), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')), '\s+', ' ', 'g')
      like permitido || '%'
  );
$$;

create or replace function puesto_con_permisos(p_puesto text)
returns boolean
language sql
immutable
as $$
  select exists (
    select 1
    from unnest(array[
      'ASESOR TIENDA',
      'RESPONSABLE RECURSOS HUMANOS',
      'GERENTE PLAZA',
      'ANALISTA EXPERIENCIA COLABORADOR',
      'PRACTICANTE',
      'SINDICATO'
    ]) as permitido
    where regexp_replace(upper(translate(coalesce(p_puesto, ''), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')), '\s+', ' ', 'g')
      like permitido || '%'
  );
$$;

create or replace function voto_puede_administrar(p_puesto text)
returns boolean
language sql
immutable
as $$
  select exists (
    select 1
    from unnest(array[
      'RESPONSABLE RECURSOS HUMANOS',
      'GERENTE PLAZA',
      'ANALISTA EXPERIENCIA COLABORADOR',
      'PRACTICANTE'
    ]) as permitido
    where regexp_replace(upper(translate(coalesce(p_puesto, ''), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')), '\s+', ' ', 'g')
      like permitido || '%'
  );
$$;

-- === Panel and approvals use the per-person check ===
create or replace function sesion_personal(p_token text, out numero text, out estado text)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  numero := sesion_empleado(p_token);
  if numero is null then
    estado := 'no_session';
  elsif not empleado_gestiona_personal(numero) then
    estado := 'not_allowed';
  else
    estado := 'ok';
  end if;
end;
$$;

create or replace function sesion_panel(p_token text)
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
    'nombre', emp.nombre,
    'avisos', voto_puede_administrar(emp.puesto),
    'personal', empleado_gestiona_personal(numero));
end;
$$;

create or replace function puede_aprobar_alta(p_aprobador text, p_empleado text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select empleado_gestiona_personal(a.numero_empleado)
      or norm_nombre(a.puesto) like 'GERENTE PLAZA%'
      or (norm_nombre(a.puesto) like 'ASESOR TIENDA%' and norm_nombre(e.asesor) <> '' and norm_nombre(e.asesor) = norm_nombre(a.nombre))
    from employees a, employees e
    where a.numero_empleado = p_aprobador and e.numero_empleado = p_empleado
  ), false);
$$;

-- === Delete the test account ===
delete from app_sessions where numero_empleado = '1599067';
delete from votacion_participantes where numero_empleado = '1599067';
delete from employees where numero_empleado = '1599067';

revoke execute on function empleado_gestiona_personal(text) from public, anon, authenticated;
revoke execute on function puesto_gestiona_personal(text) from public, anon, authenticated;
revoke execute on function puesto_con_permisos(text) from public, anon, authenticated;
revoke execute on function voto_puede_administrar(text) from public, anon, authenticated;
revoke execute on function puede_aprobar_alta(text, text) from public, anon, authenticated;
revoke execute on function sesion_personal(text) from public, anon, authenticated;
grant execute on function sesion_panel(text) to anon, authenticated;

commit;

NOTIFY pgrst, 'reload schema';
