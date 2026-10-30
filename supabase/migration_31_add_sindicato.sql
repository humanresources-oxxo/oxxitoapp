-- Migration 31: add two union (sindicato) representatives with full access
-- (puesto SINDICATO is in PUESTOS_ACTAS, src/services/actas.ts).
-- They have no employee number, and login only takes digits (4-10), so they
-- get 10-digit numbers starting with 99: real employee numbers have 7 digits,
-- so these can't collide with the roster. No PIN: they create it on first login.
insert into employees (numero_empleado, nombre, tienda, puesto)
values
  ('9900000001', 'David', 'PLAZA EMP OAXACA', 'SINDICATO'),
  ('9900000002', 'Antonio Cruz', 'PLAZA EMP OAXACA', 'SINDICATO')
on conflict (numero_empleado) do update
set nombre = excluded.nombre,
    tienda = excluded.tienda,
    puesto = excluded.puesto;
