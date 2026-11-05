-- Migration 43: the test account 1599067 ("ACCES TEST") comes back with full
-- access. Run once in Supabase SQL Editor, after migration 42.
--
-- Full access without reopening the "ACCES TEST" puesto (anyone loaded with
-- that puesto in the roster would get it too):
-- - puesto PRACTICANTE: permisos (Resumen, Estructura, Actas, CCT, DILOS) and
--   publishing avisos and votaciones (voto_puede_administrar).
-- - accesos_especiales: manages employees and PINs in the admin panel and
--   approves new accounts, like 5843652 (empleado_gestiona_personal).
-- No PIN: give it a temporary PIN from the admin panel (Empleados), sign in
-- once in the app with it and it asks for a new one.
-- To take it away again: delete from accesos_especiales and employees where
-- numero_empleado = '1599067' (and its app_sessions).

begin;

insert into employees (numero_empleado, nombre, puesto, plaza, tienda, pin_hash, alta_pendiente)
values ('1599067', 'ACCES TEST', 'PRACTICANTE', 'Oaxaca', 'Recursos Humanos', null, false)
on conflict (numero_empleado) do update
  set nombre = excluded.nombre,
      puesto = excluded.puesto,
      plaza = excluded.plaza,
      tienda = excluded.tienda,
      alta_pendiente = false;

insert into accesos_especiales (numero_empleado, gestiona_personal, nota)
values ('1599067', true, 'Cuenta de prueba de la app Conoxxo')
on conflict (numero_empleado) do update set gestiona_personal = true, nota = excluded.nota;

commit;

NOTIFY pgrst, 'reload schema';
