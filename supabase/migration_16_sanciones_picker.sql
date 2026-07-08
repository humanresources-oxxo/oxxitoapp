-- Migration 16: sanciones as a browsable list instead of one wall of text.
-- Art. 79 stays as-is in reglamento_articles (real citation), but the chat
-- now offers a picker of infracciones and only shows the one the user taps.

create table if not exists sanciones_matrix (
  id serial primary key,
  infraccion text not null,
  pasos text[] not null
);

alter table sanciones_matrix enable row level security;

create or replace function list_sanciones()
returns table(id int, infraccion text)
language sql
security definer
set search_path = public
as $$
  select s.id, s.infraccion from sanciones_matrix s order by s.id;
$$;

create or replace function get_sancion(p_id int)
returns table(id int, infraccion text, pasos text[])
language sql
security definer
set search_path = public
as $$
  select s.id, s.infraccion, s.pasos from sanciones_matrix s where s.id = p_id;
$$;

grant execute on function list_sanciones() to anon, authenticated;
grant execute on function get_sancion(int) to anon, authenticated;

insert into sanciones_matrix (infraccion, pasos) values
  ('Alterar, destruir o escribir sobre circulares/avisos oficiales de la Empresa', array['Amonestacion verbal','Acta administrativa','Acta de hechos + 1 dia de suspension sin goce','Terminacion con causa']::text[]),
  ('Captura/autorizacion de tiempo extra en sistema sin haberlo trabajado', array['Terminacion con causa (inmediato)']::text[]),
  ('Consumo de productos sin comprobacion de gasto, autorizacion o pago', array['Terminacion con causa (inmediato)']::text[]),
  ('Tomar producto/activos sin pagarlo o sin autorizacion, sustraccion de productos', array['Terminacion con causa (inmediato)']::text[]),
  ('Escribir o marcar en paredes, sanitarios o equipos', array['Acta administrativa','Acta de hechos + 2 dias de suspension sin goce de sueldo','Terminacion con causa']::text[]),
  ('Estar enterado de alguna violacion al reglamento y no avisar a la Empresa/persona correspondiente', array['Acta administrativa','Acta de hechos + 1-8 dias de suspension sin goce','Terminacion con causa']::text[]),
  ('Falsedad u omision deliberada en informacion de ingreso, datos personales, referencias o fiscales', array['Terminacion con causa (inmediato)']::text[]),
  ('Falta injustificada en un periodo de 30 dias (sin autorizacion ni incapacidad entregada oportunamente)', array['Acta administrativa','Acta de hechos + 1 dia de suspension sin goce','Acta de hechos + 2 dias de suspension sin goce','Terminacion con causa']::text[]),
  ('Uso de lenguaje, conductas o exhibiciones contrarias a la moral dentro del centro de trabajo', array['Se determinara de acuerdo con la gravedad conforme al articulo 76']::text[]),
  ('Fumar cigarro en las instalaciones', array['Terminacion con causa (inmediato)']::text[]),
  ('Fumar cigarro o vaporizador a menos de 10 metros de cualquier acceso a las instalaciones', array['Amonestacion verbal','Acta administrativa','Acta de hechos + 1 dia de suspension sin goce','Suspension de 3 dias sin goce']::text[]),
  ('Hacer colectas, rifas, tandas, ventas personales dentro de la Empresa', array['Acta administrativa','Acta de hechos + 1 dia de suspension sin goce','Suspension de 3 dias sin goce','Terminacion con causa']::text[]),
  ('Ignorar medidas de seguridad, salud y/o medio ambiente', array['Retroalimentacion escrita','Se determinara de acuerdo con la gravedad conforme al articulo 74']::text[]),
  ('Ingresar a areas restringidas/prohibidas sin autorizacion', array['Acta administrativa','Acta de hechos + 1 dia de suspension','Acta de hechos + 3 dias de suspension','Terminacion con causa']::text[]),
  ('Negarse a someterse a pruebas toxicologicas/alcoholimetria conforme al proceso interno', array['Terminacion con causa (inmediato)']::text[]),
  ('Negarse a someterse a examenes medicos periodicos determinados por SASSO', array['Terminacion con causa (inmediato)']::text[]),
  ('No avisar al jefe inmediato en la primera hora por fuerza mayor / no justificar en 24h', array['Acta administrativa','Acta de hechos + 1 dia de suspension sin goce','Acta de hechos + 2 dias de suspension sin goce','Terminacion con causa']::text[]),
  ('No informar actualizaciones de datos personales relevantes (domicilio, estado civil, etc.)', array['Acta administrativa (las 4 veces)']::text[]),
  ('Provocar accidente por incumplimiento del reglamento', array['Terminacion con causa (inmediato)']::text[]),
  ('Retardo (despues de 10 min de tolerancia, en periodo de 30 dias)', array['Amonestacion verbal','Acta administrativa','Acta de hechos + 1 dia de suspension sin goce','Suspension de 3 dias sin goce']::text[]),
  ('Resultado positivo a sustancias prohibidas sin haberlo declarado en el consentimiento informado', array['Terminacion con causa (inmediato)']::text[]),
  ('Negarse al plan de seguimiento despues de resultado positivo a sustancias prohibidas', array['Terminacion con causa (inmediato)']::text[]),
  ('Reincidencia en sustancias prohibidas', array['Terminacion con causa (inmediato)']::text[]),
  ('Presentarse a laborar bajo influjos de sustancia prohibida, aliento alcoholico o ebriedad', array['Acta de hechos + suspension de 1 dia','Terminacion con causa']::text[]),
  ('Ingresar y/o permanecer en instalaciones bajo influjos de sustancia prohibida, aliento alcoholico o ebriedad', array['Terminacion con causa (inmediato)']::text[]),
  ('Portar o introducir bebidas alcoholicas', array['Acta administrativa','Acta de hechos + suspension de 1 dia sin goce','Terminacion con causa']::text[]),
  ('Portar o introducir drogas enervantes sin prescripcion medica autorizada', array['Terminacion con causa (inmediato)']::text[]),
  ('Portar armas de fuego, punzocortantes u objetos peligrosos en instalaciones o vehiculos', array['Terminacion con causa (inmediato)']::text[]),
  ('Abandonar el puesto, dormirse o suspender labores durante la jornada sin autorizacion', array['Terminacion con causa (inmediato)']::text[]),
  ('No obedecer instrucciones del jefe inmediato / incumplir procedimientos internos', array['Terminacion con causa (inmediato)']::text[]),
  ('Negarse a colaborar o dar explicacion sobre desempeno / negarse a investigacion interna', array['Acta de hechos + 1 a 3 dias de suspension sin goce','Suspension hasta 8 dias sin goce','Terminacion con causa']::text[]),
  ('Uso indebido o maltrato de uniforme (no presentarse con uniforme completo)', array['Amonestacion verbal','Acta de hechos + 1 dia de suspension sin goce','Suspension 3 dias sin goce','Terminacion con causa']::text[]),
  ('Usar o portar uniforme para actividades personales o no laborales', array['Amonestacion verbal','Acta de hechos + 1 dia de suspension sin goce','Suspension 3 dias sin goce','Terminacion con causa']::text[]),
  ('Participar en pelea, rina o faltas a la moral en via publica usando el uniforme', array['Terminacion con causa (inmediato)']::text[]),
  ('Prestar/permitir uso de gafete o credencial a otra persona', array['Terminacion con causa (inmediato)']::text[]),
  ('Uso de equipos/herramientas de trabajo para fines personales o sin autorizacion', array['Terminacion con causa (inmediato)']::text[]),
  ('Dano, perdida o extravio de herramienta por negligencia sin aviso inmediato', array['Acta administrativa + obligacion de informar y documentar','Suspension hasta 8 dias sin goce','Terminacion con causa']::text[]),
  ('No mantener limpio y en buen estado el area de trabajo, equipo, banos, comedor, etc.', array['Amonestacion verbal','Acta administrativa','Acta de hechos + 1 dia de suspension sin goce','Suspension 3 dias sin goce']::text[]),
  ('Ejecutar actos que pongan en peligro la propia seguridad, companeros, clientes o continuidad operativa', array['Depende de la gravedad e impacto: desde amonestacion escrita hasta terminacion con causa']::text[]),
  ('Remover, alterar o interferir con equipo o senaletica de seguridad (extintores, alarmas, etc.)', array['Terminacion con causa (inmediato)']::text[]),
  ('Uso inadecuado de la silla de descanso', array['Amonestacion verbal','Amonestacion por escrito','Suspension 1 dia sin goce','Terminacion con causa']::text[]),
  ('Hacer bromas, juegos de mano, palabras obscenas, maltratos que generen disgustos o rinas', array['Acta de hechos + 1 dia de suspension sin goce','Suspension 3 dias sin goce','Terminacion con causa']::text[]),
  ('Acoso laboral, hostigamiento, maltrato psicologico, acoso sexual, violencia fisica o amenazas', array['Terminacion con causa (inmediato)']::text[]),
  ('Participar en rinas, agresiones fisicas o verbales dentro del centro de trabajo', array['Terminacion con causa (inmediato)']::text[]),
  ('Uso de usuarios o contrasenas de otro colaborador / compartir accesos de sistema', array['Acta de hechos + 1 dia de suspension sin goce','Suspension 3 dias sin goce','Terminacion con causa (si genera beneficio personal o vulnerabilidad tecnologica: terminacion con causa directo)']::text[]),
  ('Permitir permanencia o participacion de personas no autorizadas/ajenas (familiares, menores, amigos) en el centro de trabajo', array['Amonestacion escrita','Suspension 3 dias sin goce','Suspension hasta 8 dias sin goce','Terminacion con causa']::text[]),
  ('No reportar de inmediato notificaciones oficiales de autoridad recibidas dentro de las 24h', array['Acta de hechos + 1 dia de suspension sin goce','Suspension hasta 8 dias sin goce','Terminacion con causa']::text[]),
  ('Uso del nombre/marca/imagen de la Empresa en redes sociales, postura politica/social/religiosa a nombre de la compania, divulgar info confidencial', array['Suspension hasta 8 dias sin goce','Terminacion con causa (si hay impacto reputacional/operativo alto o critico)']::text[]),
  ('Falsear, alterar, ocultar u omitir informacion en registros, investigaciones o reportes internos', array['Se determinara de acuerdo con la gravedad']::text[]);

NOTIFY pgrst, 'reload schema';
