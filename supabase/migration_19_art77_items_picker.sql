-- Migration 19: Art. 77 (obligaciones de los trabajadores, 25 items) is another
-- wall-of-text article. Same picker treatment as the sanciones tables, but
-- generalized to any article that's really a flat list of items (no per-item
-- escalation steps needed, unlike sanciones_matrix).

create table if not exists reglamento_items (
  id serial primary key,
  label text not null,
  body text not null,
  article_number int not null
);

alter table reglamento_items enable row level security;

create or replace function list_reglamento_items(p_article int)
returns table(id int, label text)
language sql
security definer
set search_path = public
as $$
  select i.id, i.label from reglamento_items i where i.article_number = p_article order by i.id;
$$;

create or replace function get_reglamento_item(p_id int)
returns table(id int, label text, body text, article_number int)
language sql
security definer
set search_path = public
as $$
  select i.id, i.label, i.body, i.article_number from reglamento_items i where i.id = p_id;
$$;

grant execute on function list_reglamento_items(int) to anon, authenticated;
grant execute on function get_reglamento_item(int) to anon, authenticated;

insert into reglamento_items (label, body, article_number) values
  ('Observar las disposiciones contenidas en la Ley, el presente Reglament…', 'Observar las disposiciones contenidas en la Ley, el presente Reglamento y en general las disposiciones de las normas de trabajo que le sean aplicables.', 77),
  ('Informar a la Empresa de los cambios de información personal relevante…', 'Informar a la Empresa de los cambios de información personal relevante como: domicilio, estado civil, nacimientos, defunciones, entre otros.', 77),
  ('Desempeñar el trabajo encomendado con la mayor intensidad y eficiencia…', 'Desempeñar el trabajo encomendado con la mayor intensidad y eficiencia a fin de lograr la mayor calidad y productividad posible.', 77),
  ('Obedecer las instrucciones para el cumplimiento de su trabajo.', 'Obedecer las instrucciones para el cumplimiento de su trabajo.', 77),
  ('Conocer, respetar y cumplir los procedimientos operativos, administrat…', 'Conocer, respetar y cumplir los procedimientos operativos, administrativos y las políticas internas de la Empresa.', 77),
  ('Brindar la explicación que le sea solicitada por el jefe inmediato, re…', 'Brindar la explicación que le sea solicitada por el jefe inmediato, relacionada con el desempeño de su trabajo.', 77),
  ('Dar aviso inmediato al patrón de las causas que le impidan asistir a s…', 'Dar aviso inmediato al patrón de las causas que le impidan asistir a su trabajo.', 77),
  ('Iniciar puntualmente sus funciones en el horario establecido.', 'Iniciar puntualmente sus funciones en el horario establecido.', 77),
  ('Apego a valores institucionales y buenas costumbres dentro y fuera de…', 'Apego a valores institucionales y buenas costumbres dentro y fuera de la Empresa.', 77),
  ('Reportar cualquier acto deshonesto a Recursos Humanos o mediante el Si…', 'Reportar cualquier acto deshonesto a Recursos Humanos o mediante el Sistema de Denuncias FEMSA.', 77),
  ('Presentarse a sus labores con uniforme completo. Si el Trabajador no c…', 'Presentarse a sus labores con uniforme completo. Si el Trabajador no cumple con esta disposición, la Empresa se reserva el derecho de regresarlo y considerarlo como una falta injustificada.', 77),
  ('Portar la credencial de identificación durante la jornada de trabajo e…', 'Portar la credencial de identificación durante la jornada de trabajo en lugar visible, así como su cuidado y buen uso.', 77),
  ('Prestar auxilios en cualquier tiempo que se necesiten cuando por sinie…', 'Prestar auxilios en cualquier tiempo que se necesiten cuando por siniestro o riesgo inminente peligren las personas o los intereses del patrón o de sus compañeros de trabajo.', 77),
  ('Permitir que la Empresa verifique los casilleros personales de cada Tr…', 'Permitir que la Empresa verifique los casilleros personales de cada Trabajador, siempre con la presencia del interesado y/o delegado sindical.', 77),
  ('Conservar en buen estado el equipo, instalaciones y herramientas que s…', 'Conservar en buen estado el equipo, instalaciones y herramientas que se les proporcionen para el trabajo.', 77),
  ('Observar buen comportamiento durante el servicio y en general durante…', 'Observar buen comportamiento durante el servicio y en general durante su permanencia dentro de las instalaciones de la Empresa.', 77),
  ('Participar en la identificación de los factores de riesgo psicosocial…', 'Participar en la identificación de los factores de riesgo psicosocial y en la evaluación del entorno organizacional favorable, las capacitaciones, programas de información, sensibilización, reuniones con los representantes de la Empresa, informar sobre las áreas de oportunidad dentro de la organización y exponer dudas, inquietudes y/o quejas relacionadas con su trabajo.', 77),
  ('Reportar al departamento de Recursos Humanos, los cambios que hubiera…', 'Reportar al departamento de Recursos Humanos, los cambios que hubiera en sus datos socioeconómicos (domicilio, dependientes, etc.).', 77),
  ('Obedecer las órdenes de carácter definitivo o transitorio que se les d…', 'Obedecer las órdenes de carácter definitivo o transitorio que se les den para la ejecución de su trabajo y tratar con la debida corrección tanto a sus jefes como a sus compañeros de trabajo y clientes.', 77),
  ('Someterse a las investigaciones necesarias que practiquen los represen…', 'Someterse a las investigaciones necesarias que practiquen los representantes de la Empresa, para la aplicación de lo establecido en el Capítulo de disposiciones disciplinarias de este Reglamento.', 77),
  ('En caso de siniestro o riesgo inminente que ponga en peligro a los int…', 'En caso de siniestro o riesgo inminente que ponga en peligro a los intereses de la Empresa, compañeros o clientes y a sí mismo, el Trabajador deberá informar de manera inmediata a su supervisor en turno.', 77),
  ('Hacer del conocimiento de la Empresa, las enfermedades contagiosas que…', 'Hacer del conocimiento de la Empresa, las enfermedades contagiosas que padezcan.', 77),
  ('Falsear, alterar, ocultar u omitir información, ya sea de manera inten…', 'Falsear, alterar, ocultar u omitir información, ya sea de manera intencional o por negligencia, en reportes, registros, formularios, entrevistas, investigaciones internas o cualquier otro medio oficial de comunicación.', 77),
  ('Respetar los reglamentos municipales, estatales y federales para este…', 'Respetar los reglamentos municipales, estatales y federales para este tipo de establecimientos.', 77),
  ('Las demás establecidas en la Ley, y el presente reglamento interior de…', 'Las demás establecidas en la Ley, y el presente reglamento interior de trabajo.', 77);

NOTIFY pgrst, 'reload schema';
