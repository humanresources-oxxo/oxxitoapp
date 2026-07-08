-- Migration 18: Art. 93 (sanciones especiales tienda) and Art. 106 (sanciones
-- especiales CEDIS) have the same garbled-table problem Art. 79 had. Reuse the
-- sanciones_matrix picker pattern for them, tagged by article_number.

alter table sanciones_matrix add column if not exists article_number int not null default 79;

drop function if exists list_sanciones();

create or replace function list_sanciones(p_article int default 79)
returns table(id int, infraccion text)
language sql
security definer
set search_path = public
as $$
  select s.id, s.infraccion from sanciones_matrix s where s.article_number = p_article order by s.id;
$$;

grant execute on function list_sanciones(int) to anon, authenticated;

drop function if exists get_sancion(int);

create or replace function get_sancion(p_id int)
returns table(id int, infraccion text, pasos text[], article_number int)
language sql
security definer
set search_path = public
as $$
  select s.id, s.infraccion, s.pasos, s.article_number from sanciones_matrix s where s.id = p_id;
$$;

grant execute on function get_sancion(int) to anon, authenticated;

create or replace function search_reglamento(q text)
returns table(article text, number int, body text, rank real)
language sql
security definer
set search_path = public
as $$
  select a.article, a.number, a.body,
    (
      ts_rank(a.search, query.tsq)
      + case when a.number in (79, 93, 106) and query.tsq::text ~ 'sancion' then 0.5 else 0 end
    ) as rank
  from reglamento_articles a,
       to_tsquery('spanish', replace(plainto_tsquery('spanish', q)::text, ' & ', ' | ')) query(tsq)
  where a.search @@ query.tsq and not a.excluded_from_chat
  order by rank desc
  limit 3;
$$;

grant execute on function search_reglamento(text) to anon, authenticated;

insert into sanciones_matrix (infraccion, pasos, article_number) values
  ('Depósitos bancarios de corresponsalías a cuentas personales o de cualquier persona sin ingresar físicamente el dinero en la caja de venta', array['Terminación con causa (inmediato)']::text[], 93),
  ('Realizar operaciones en beneficio personal y en perjuicio del negocio (uso de recursos para ganancia propia)', array['Terminación con causa (inmediato)']::text[], 93),
  ('Falta de mercancía en inventario (0.5% a 0.7% sobre venta, con base a la meta definida por la Empresa y por cada Centro de Trabajo)', array['Acta de hechos + amonestación verbal','Acta administrativa','Terminación con causa']::text[], 93),
  ('Falta de mercancía en inventario (más del 0.7% sobre venta)', array['Acta administrativa','Terminación con causa']::text[], 93),
  ('Faltante de efectivo en cortes de caja o depósito', array['Acta administrativa + pago de faltante','Acta de hechos + hasta 3 días de suspensión sin goce de sueldo y pago de faltante','Terminación con causa + pago de faltante']::text[], 93),
  ('Incumplimiento de retiros parciales, depósito de dinero en tómbola', array['Acta administrativa','Acta de hechos + 1 día de suspensión sin goce de sueldo','Acta de hechos + 2 días de suspensión sin goce de sueldo','Terminación con causa']::text[], 93),
  ('Negarse a firmar acta de inventario', array['Acta administrativa','Terminación con causa']::text[], 93),
  ('No permanecer hasta el término del proceso de inventarios sin causa justificada', array['Acta administrativa','Terminación con causa']::text[], 93),
  ('Realizar devoluciones ficticias a clientes/proveedores/CEDIS', array['Acta administrativa','Terminación con causa']::text[], 93),
  ('Venta de bebidas alcohólicas fuera de horario establecido', array['Terminación con causa (inmediato)']::text[], 93),
  ('Venta de bebidas alcohólicas y/o cigarros a menores de edad', array['Terminación con causa (inmediato)']::text[], 93),
  ('Caminar junto al equipo móvil en operación', array['Acta de hechos + amonestación verbal','Acta administrativa','Acta de hechos + de 1 a 3 días de suspensión sin goce de sueldo','Terminación con causa']::text[], 106),
  ('No ceder el paso a peatones en zonas compartidas', array['Acta de hechos + suspensión de 1 a 3 días sin goce de sueldo','Terminación con causa']::text[], 106),
  ('No detenerse en cruces peatonales o zonas de alto riesgo', array['Acta de hechos + suspensión de 1 a 3 días sin goce de sueldo','Terminación con causa']::text[], 106),
  ('No portar el EPP completo en zonas operativas de CEDIS', array['Acta de hechos + amonestación verbal','Acta administrativa','Acta de hechos + de 1 a 3 días de suspensión sin goce de sueldo','Terminación con causa']::text[], 106),
  ('No realizar inspección diaria del equipo móvil', array['Acta administrativa','Acta de hechos + de 3 a 5 días de suspensión sin goce de sueldo','Terminación con causa']::text[], 106),
  ('No reportar fallas, condiciones inseguras, daños o irregularidades de instalaciones / maquinaria', array['Acta administrativa','Acta de hechos + de 3 a 5 días de suspensión sin goce de sueldo','Terminación con causa']::text[], 106),
  ('No respetar distancia mínima entre peatón y equipo móvil', array['Acta administrativa','Acta de hechos + de 3 a 5 días de suspensión sin goce de sueldo','Terminación con causa']::text[], 106),
  ('No reportar condiciones inseguras o fallas del equipo', array['Acta administrativa','Acta de hechos + de 3 a 5 días de suspensión sin goce de sueldo','Terminación con causa']::text[], 106),
  ('No respetar límites de velocidad establecidos en equipos móviles', array['Acta de hechos + suspensión de 1 a 3 días sin goce de sueldo','Terminación con causa']::text[], 106),
  ('No respetar señalización o rutas peatonales', array['Acta de hechos + amonestación verbal','Acta administrativa','Acta de hechos + de 1 a 3 días de suspensión sin goce de sueldo','Terminación con causa']::text[], 106),
  ('Obstruir salidas de emergencia con equipo móvil', array['Acta de hechos + suspensión de 1 a 3 días sin goce de sueldo','Terminación con causa']::text[], 106),
  ('Operar equipo móvil sin licencia vigente o vencida', array['Acta administrativa','Acta de hechos + de 3 a 5 días de suspensión sin goce de sueldo','Terminación con causa']::text[], 106),
  ('Operar equipo tras incidente sin autorización médica o técnica', array['Terminación con causa (inmediato)']::text[], 106),
  ('Prestar equipo móvil a personal no autorizado', array['Acta administrativa','Acta de hechos + de 3 a 5 días de suspensión sin goce de sueldo','Terminación con causa']::text[], 106),
  ('Realizar movimientos simultáneos sin autorización', array['Acta de hechos + suspensión de 1 a 3 días sin goce de sueldo','Terminación con causa']::text[], 106),
  ('Ser sorprendido jugando en el área de trabajo o áreas comunes no designadas para la recreación', array['Amonestación escrita','Se determinará de acuerdo con la gravedad conforme al artículo 74']::text[], 106),
  ('Transitar con carga elevada que obstruya la visibilidad', array['Acta de hechos + suspensión de 1 a 3 días sin goce de sueldo','Terminación con causa']::text[], 106),
  ('Uso de celular / audífonos en zonas operativas sin autorización, fuera de las zonas designadas para su uso', array['Acta de hechos + amonestación verbal','Acta administrativa','Acta de hechos + hasta 3 días de suspensión sin goce de sueldo','Terminación con causa']::text[], 106),
  ('No tener el cabello recogido y asegurado y/o portar accesorios en áreas productivas', array['Acta de hechos + amonestación verbal','Acta administrativa','Acta de hechos + 1 día de suspensión sin goce','Acta de hechos + 3 días de suspensión sin goce']::text[], 106);

NOTIFY pgrst, 'reload schema';
