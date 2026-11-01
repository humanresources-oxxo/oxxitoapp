-- Migration 31: two users without an employee number (they are not in the
-- payroll), so each gets an invented 8-digit number in the 9000000x range:
-- real employee numbers have at most 7 digits, so these never collide with
-- one. They log in with this number and create their PIN on first login.
-- No puesto that opens Actas/Estructura/Cuota sindical (see PUESTOS_ACTAS in
-- src/services/actas.ts); their phones are not stored (employees has no
-- phone column).
--   90000001  David (Sindicato)  +52 1 993 308 1104
--   90000002  Antonio Cruz       +52 1 951 175 1941

insert into employees (numero_empleado, nombre, puesto)
values
  ('90000001', 'David', 'SINDICATO'),
  ('90000002', 'Antonio Cruz', null)
on conflict (numero_empleado) do nothing;
