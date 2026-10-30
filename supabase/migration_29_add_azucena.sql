-- Migration 29: add one employee from a roster snippet (unidad org / puesto).
insert into employees (numero_empleado, nombre, tienda, puesto)
values ('1709718', 'Azucena Del Carmen Carrasco Martínez', 'PLAZA EMP OAXACA', 'GERENTE PLAZA OAXACA')
on conflict (numero_empleado) do update
set tienda = excluded.tienda,
    puesto = excluded.puesto;
