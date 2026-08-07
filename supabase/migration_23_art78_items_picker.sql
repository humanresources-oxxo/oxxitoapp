-- Migration 23: Art. 78 (prohibiciones a los trabajadores, ~28 items) has the
-- same numeral-vs-text misalignment defect Art. 77 had, from the PDF's
-- two-column reflow. Same items picker treatment, also drop the debug
-- length-check function used to audit which articles were too long.

insert into reglamento_items (label, body, article_number) values
  ('Ejecutar cualquier acto que pueda poner en peligro su propia seguridad…', 'Ejecutar cualquier acto que pueda poner en peligro su propia seguridad, la de sus compañeros de trabajo o la de terceros, así como las propiedades de la Empresa.', 78),
  ('Faltar al trabajo sin causa justificada.', 'Faltar al trabajo sin causa justificada.', 78),
  ('Ingresar aparatos electrónicos sin autorización de parte del área de p…', 'Ingresar aparatos electrónicos sin autorización de parte del área de protección patrimonial.', 78),
  ('Ingresar a las áreas de la Empresa las cuales estén restringidas solo…', 'Ingresar a las áreas de la Empresa las cuales estén restringidas solo para el personal autorizado.', 78),
  ('Destruir, borrar o poner notas en circulares, boletines o avisos que c…', 'Destruir, borrar o poner notas en circulares, boletines o avisos que coloque la Empresa.', 78),
  ('Hacer propaganda de cualquier tipo, rifas, tandas, cajas de ahorro, co…', 'Hacer propaganda de cualquier tipo, rifas, tandas, cajas de ahorro, cooperativas, ventas, préstamos, operaciones y colectas de cualquier tipo.', 78),
  ('Presentarse al trabajo con aliento alcohólico o en estado de ebriedad…', 'Presentarse al trabajo con aliento alcohólico o en estado de ebriedad o bajo los efectos de algún narcótico o droga enervante, o bien el uso de estos en las instalaciones y/o en el desarrollo de su trabajo.', 78),
  ('Portar armas de cualquier clase.', 'Portar armas de cualquier clase.', 78),
  ('Tomar cervezas y/o bebidas embriagantes durante horas de trabajo y/o d…', 'Tomar cervezas y/o bebidas embriagantes durante horas de trabajo y/o durante su permanencia en el local de la Empresa, introducir materiales inflamables o drogas enervantes y toda clase de armas en las instalaciones y/o unidades de reparto y servicio.', 78),
  ('Consumir drogas enervantes salvo prescripción médica.', 'Consumir drogas enervantes salvo prescripción médica.', 78),
  ('Hacer bromas, maldades, juegos de mano o proferir palabras obscenas a…', 'Hacer bromas, maldades, juegos de mano o proferir palabras obscenas a sus compañeros de trabajo, representantes de la Empresa o clientes, así como todo trato indebido que pueda provocar disgustos o riñas.', 78),
  ('Practicar juegos de azar dentro de la Empresa.', 'Practicar juegos de azar dentro de la Empresa.', 78),
  ('Abandonar su puesto, dormirse o suspender sus labores durante su jorna…', 'Abandonar su puesto, dormirse o suspender sus labores durante su jornada de trabajo.', 78),
  ('Hacer colectas o rifas en el interior de la Empresa.', 'Hacer colectas o rifas en el interior de la Empresa.', 78),
  ('Escribir leyendas en las paredes, servicios sanitarios y/o cualquier o…', 'Escribir leyendas en las paredes, servicios sanitarios y/o cualquier otro equipo perteneciente a la Empresa.', 78),
  ('Permitir a personas ajenas a la Empresa o a personal no autorizado su…', 'Permitir a personas ajenas a la Empresa o a personal no autorizado su estancia en las instalaciones de esta, sus dependencias o establecimientos, incluyendo a toda persona ajena a la Empresa, menores de edad, familiares, amigos, etc.', 78),
  ('Realizar operaciones en beneficio personal y en perjuicio del negocio.', 'Realizar operaciones en beneficio personal y en perjuicio del negocio.', 78),
  ('Vender a menores de edad y/o fuera del horario establecido, vinos, lic…', 'Vender a menores de edad y/o fuera del horario establecido, vinos, licores, cervezas, cigarros y cualquier otro producto que tenga dicha restricción.', 78),
  ('Hacer uso del nombre, marca, e imagen de Cadena Comercial Oxxo S.A. de…', 'Hacer uso del nombre, marca, e imagen de Cadena Comercial Oxxo S.A. de C.V. en medios de comunicación, redes sociales públicas o personales y/o cualquier medio público.', 78),
  ('Utilizar el sistema punto de venta para efectuar depósitos bancarios d…', 'Utilizar el sistema punto de venta para efectuar depósitos bancarios de corresponsalías a cuentas personales o de cualquier persona sin ingresar físicamente el dinero de esta operación en la caja de venta.', 78),
  ('Tomar producto de la tienda sin pagarlo previamente o del centro de tr…', 'Tomar producto de la tienda sin pagarlo previamente o del centro de trabajo sin que haya sido otorgado por representante de la Empresa.', 78),
  ('Utilizar usuarios de otro empleado bajo ninguna situación.', 'Utilizar usuarios de otro empleado bajo ninguna situación.', 78),
  ('Compartir contraseñas de sistema que son de uso personal.', 'Compartir contraseñas de sistema que son de uso personal.', 78),
  ('Vender productos que no sean parte del inventario o catálogo de la tie…', 'Vender productos que no sean parte del inventario o catálogo de la tienda.', 78),
  ('Iniciar, participar o incitar a riñas, agresiones físicas o verbales d…', 'Iniciar, participar o incitar a riñas, agresiones físicas o verbales dentro del centro de trabajo.', 78),
  ('Participar en conflictos o peleas fuera del centro de trabajo cuando s…', 'Participar en conflictos o peleas fuera del centro de trabajo cuando se porte el uniforme de la Empresa o se represente a la misma.', 78),
  ('Agredir, amenazar o confrontar de manera violenta a compañeros de trab…', 'Agredir, amenazar o confrontar de manera violenta a compañeros de trabajo, clientes, proveedores o terceros vinculados con la Empresa.', 78),
  ('Las demás señaladas en la Ley y en el presente reglamento interior de…', 'Las demás señaladas en la Ley y en el presente reglamento interior de trabajo.', 78);

drop function if exists debug_article_lengths();

NOTIFY pgrst, 'reload schema';
