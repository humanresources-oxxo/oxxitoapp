-- Migration 48: notice periods and Art. 90 exactly as the signed RIT says
-- (RIT_Homologado_OXXO2026_Firmado.pdf). Run once in Supabase SQL Editor, after 47.
-- Each change checks the question id AND its article.
--
-- * Arts. 22 and 32 (general chapters) say 48 hours; Arts. 86 and 87 (Capítulo XX,
--   Disposiciones especiales para tiendas) say 24 hours. Each answer gives its own
--   article's rule and names the other one, so the chat never shows only half.
-- * Art. 90 is quoted word for word ("en un lapso mayor a setenta y dos (72) horas").

begin;

update reglamento_faq
set pregunta = '¿Con cuánta anticipación me deben avisar mi horario si no es fijo?',
    respuesta = 'Si tu horario no es fijo o puede cambiar, la Empresa debe notificártelo con al menos 48 horas de anticipación, por escrito (en medio físico o electrónico) y con los días y horas de trabajo. Para el personal de tienda, el Capítulo XX dice que la Empresa puede modificar el horario avisando con 24 horas de anticipación (Art. 86). (Art. 22)',
    estado = 'aprobada', revisado_por = 'ajuste-sql-48', revisado_en = now()
where id = 25 and articulo = 22;

update reglamento_faq
set pregunta = '¿Qué pasa si la empresa cambia mis días de descanso?',
    respuesta = 'Tus días de descanso son los fijados en tu Contrato de Trabajo. La Empresa puede cambiarlos si te lo comunica con por lo menos 48 horas de anticipación. Para el personal de tienda, el Capítulo XX dice que basta con avisar con 24 horas de anticipación (Art. 87). (Art. 32)',
    estado = 'aprobada', revisado_por = 'ajuste-sql-48', revisado_en = now()
where id = 35 and articulo = 32;

update reglamento_faq
set pregunta = 'Si trabajo en tienda, ¿pueden cambiarme el horario?',
    respuesta = 'Sí. En tiendas, la Empresa fija el horario según las necesidades de cada tienda (deben abrir los 365 días del año) y puede modificarlo si te lo comunica con 24 horas de anticipación. Es la regla del capítulo de tiendas; el Art. 22, de aplicación general, habla de 48 horas para notificar horarios que no son fijos. (Art. 86)',
    estado = 'aprobada', revisado_por = 'ajuste-sql-48', revisado_en = now()
where id = 106 and articulo = 86;

update reglamento_faq
set pregunta = 'Si trabajo en tienda, ¿pueden cambiarme los días de descanso?',
    respuesta = 'Sí. En tiendas, la Empresa puede cambiar tus días de descanso si te lo comunica con 24 horas de anticipación. Es la regla del capítulo de tiendas; el Art. 32, de aplicación general, habla de 48 horas. (Art. 87)',
    estado = 'aprobada', revisado_por = 'ajuste-sql-48', revisado_en = now()
where id = 107 and articulo = 87;

update reglamento_faq
set respuesta = 'Eres responsable del cuidado del efectivo que manejas en la tienda. Si hay un faltante, se aplican las medidas disciplinarias del Reglamento y, según el texto del artículo, el faltante "se deberá reponer en un lapso mayor a setenta y dos (72) horas". (Art. 90)',
    estado = 'aprobada', revisado_por = 'ajuste-sql-48', revisado_en = now()
where id = 110 and articulo = 90;

-- What changed (shows in the SQL Editor's result): 5 rows, all 'aprobada'.
select id, articulo, estado, pregunta, left(respuesta, 70) as respuesta
from reglamento_faq where revisado_por = 'ajuste-sql-48' order by id;

commit;

notify pgrst, 'reload schema';
