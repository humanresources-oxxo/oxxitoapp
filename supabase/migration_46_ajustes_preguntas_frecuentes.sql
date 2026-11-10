-- Migration 46: fixes to approved preguntas frecuentes (review of 2026-11-10).
-- Run once in Supabase SQL Editor. Each change checks the question id AND its
-- article, so it does nothing if that row is not the one reviewed. Nothing is
-- invented from the reglamento: dubious numbers are removed or the question is
-- set aside ('descartada') until RH confirms against the RIT; from the Panel
-- Conoxxo, "Volver a revisión" brings any of them back.

begin;

-- Art. 90: "reponerlo en un lapso mayor a 72 horas" (probably "no mayor"):
-- no deadline until RH confirms it.
update reglamento_faq
set respuesta = 'Eres responsable del cuidado del efectivo que manejas. Si hay un faltante, se aplican las medidas disciplinarias del Reglamento y debes reponerlo en el plazo que marca el artículo; confírmalo con tu líder o con Recursos Humanos. (Art. 90)',
    revisado_por = 'ajuste-sql-46', revisado_en = now()
where id = 110 and articulo = 90;

-- Arts. 22 and 32 say 48 hours' notice, Arts. 86 and 87 say 24 hours: out of
-- the chat until RH confirms which one applies to store staff.
update reglamento_faq
set estado = 'descartada', revisado_por = 'ajuste-sql-46', revisado_en = now()
where (id, articulo) in ((25, 22), (35, 32), (106, 86), (107, 87));

-- Art. 85: the answer started with a confusing "No necesariamente".
update reglamento_faq
set respuesta = 'Sí. La Empresa puede cambiarte de tienda, de forma temporal o definitiva, pero debe avisarte con 24 horas de anticipación. (Art. 85)',
    revisado_por = 'ajuste-sql-46', revisado_en = now()
where id = 105 and articulo = 85;

-- Art. 52: the last sentence contradicted the first one.
update reglamento_faq
set respuesta = 'No por tu cuenta. Avisa de inmediato a tu supervisor en turno o a un representante de la Empresa: solo con su orden expresa se envía al accidentado a una institución médica. (Art. 52)',
    revisado_por = 'ajuste-sql-46', revisado_en = now()
where id = 59 and articulo = 52;

-- What changed (shows in the SQL Editor's result).
select id, articulo, estado, left(respuesta, 70) as respuesta
from reglamento_faq where revisado_por = 'ajuste-sql-46' order by id;

commit;
