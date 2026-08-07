-- Migration 22: add a "puesto" column (position/role) and upsert 22 employees
-- from a roster snippet that only had numero + nombre + puesto (no
-- tienda/plaza/asesor). Existing employees just get their puesto filled in
-- without touching their other fields; new ones are inserted with
-- tienda/plaza/asesor left null.

alter table employees add column if not exists puesto text;

insert into employees (numero_empleado, nombre, puesto)
values
  ('5883362', 'Edgar Jonathan Bautista Ventura', 'ASESOR TIENDA'),
  ('5843652', 'Angel De Jesus Franco Gijon', 'PRACTICANTE'),
  ('5832542', 'Jordan Vazquez Toala', 'ASESOR TIENDA'),
  ('5831760', 'Cristian Giovani Carbajal Herrera', 'RESPONSABLE RECURSOS HUMANOS'),
  ('5760013', 'Mariano Lara Cabrera', 'ASESOR TI'),
  ('5700457', 'Laura Alejandra Moreno Mayoral', 'ASESOR TIENDA'),
  ('5658801', 'Lizeth Gregorio Bautista', 'ANALISTA EXPERIENCIA COLABORADOR'),
  ('5615181', 'Angel Armando Barrita Cruz', 'RECEPCIONISTA'),
  ('5018736', 'Michelle Guadalupe Aguilar Enriquez', 'COORDINADOR EJECUCION COMERCIAL'),
  ('5013779', 'Yesenia Chavez Soriano', 'COORDINADOR ADMINISTRATIVO'),
  ('5001504', 'Ernesto Cruz Marquez', 'ASESOR TIENDA'),
  ('3703784', 'Miguel Angel Gonzalez Catalan', 'ASESOR TI'),
  ('3311400', 'Mirna Martinez Lorenzo', 'ASESOR TIENDA'),
  ('3138120', 'Luis Javier Ramos Cruz', 'ASESOR TIENDA'),
  ('3134824', 'Osvaldo Fabian Navarro Urbina', 'RESPONSABLE ADMINISTRATIVO'),
  ('1879908', 'Jorge Adrian Posadas Lopez', 'ASESOR TIENDA'),
  ('1740967', 'Marisela Muñoz Sarabia', 'ASESOR TIENDA'),
  ('1708219', 'Hector Demetrio Reyes Galo', 'ASESOR TIENDA'),
  ('1635425', 'Hector Ricardo Ramirez Symor', 'RESPONSABLE COMERCIAL'),
  ('1592710', 'Timoteo Antonio Perez', 'ASESOR TIENDA CV'),
  ('1567089', 'Sofia Caridad Jimenez Gomez', 'ASESOR TIENDA'),
  ('1539435', 'Reyna Alicia Reyes Garcia', 'ASESOR TIENDA')
on conflict (numero_empleado) do update set puesto = excluded.puesto;

NOTIFY pgrst, 'reload schema';
