-- Migration 47: review against the signed RIT (RIT_Homologado_OXXO2026_Firmado.pdf,
-- 2026-11-11). Run once in Supabase SQL Editor, after 46. Every change checks the
-- row it expects, so it does nothing if that row is not the one reviewed.
--
-- Not changed here, because the signed document itself is ambiguous (RH decides):
-- * Arts. 22 and 32 (general chapters) say 48 hours' notice; Arts. 86 and 87
--   (Capítulo XX, Disposiciones especiales para tiendas) say 24 hours. FAQ 25,
--   35, 106 and 107 stay 'descartada'.
-- * Art. 90 says "reponer dicho faltante en un lapso mayor a setenta y dos (72)
--   horas" (probably "no mayor"). FAQ 110 keeps the answer without a deadline.

begin;

-- Art. 60 was cut off in the database ("...conforme al"). Full text from the PDF.
update reglamento_articles
set body = 'La modalidad de teletrabajo se aplicará conforme al Capítulo XII Bis de la Ley siempre que la naturaleza del trabajo lo permita y bajo convenio entre el Trabajador y la Empresa.'
where number = 60 and body = 'La modalidad de teletrabajo se aplicará conforme al';

-- FAQ 1 (Art. 1) asked the same question as FAQ 87 (Art. 76) with a different
-- list. Art. 1 is the definition, so it becomes the "what is a sanción" question.
update reglamento_faq
set pregunta = '¿Qué es una sanción según el reglamento?',
    respuesta = 'Es una medida disciplinaria por incumplir el Reglamento, las políticas, lineamientos o procedimientos internos, o la ley laboral. Se aplica según la gravedad de la falta, tus antecedentes y las circunstancias, y puede ser amonestación verbal, amonestación escrita, suspensión de 1 a 8 días sin goce de salario o terminación de la relación laboral, solo en los casos que prevé la ley o cuando la falta lo amerite por su gravedad. (Art. 1)',
    revisado_por = 'ajuste-sql-47', revisado_en = now()
where id = 1 and articulo = 1;

-- FAQ 87 (Art. 76): same list as the article, plus its own note about actas.
update reglamento_faq
set respuesta = 'Según la falta: amonestación verbal, acta de hechos, amonestación por escrito o acta administrativa, suspensión sin goce de sueldo hasta por ocho días, o rescisión de la relación de trabajo sin responsabilidad para la Empresa. El mismo artículo aclara que el acta de hechos y el acta administrativa sirven para documentar la conducta y no se consideran sanción. (Art. 76)',
    revisado_por = 'ajuste-sql-47', revisado_en = now()
where id = 87 and articulo = 76;

-- What changed (shows in the SQL Editor's result).
select 'faq ' || id as fila, left(pregunta, 60) as pregunta, left(respuesta, 70) as respuesta
from reglamento_faq where revisado_por = 'ajuste-sql-47'
union all
select 'art ' || number, article, left(body, 70) from reglamento_articles where number = 60
order by 1;

commit;

NOTIFY pgrst, 'reload schema';
