-- Migration 20: The signed RIT PDF genuinely reuses article numbers 75, 76, 77
-- and 78 for two different chapters (a document authoring defect, verified
-- against the original PDF - not an extraction error). Both rows are kept
-- as-is (neither is "wrong"), but ts_rank alone picks the wrong one for some
-- questions (e.g. asking about worker obligations returned the "Empresa"
-- duplicate of Art. 75 instead of Art. 77). Boost whichever duplicate
-- actually matches the question's topic.

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
      + case
          when a.number = 75 and a.body ilike '%labores insalubres%' and query.tsq::text ~ 'insalubr|peligros|gestacion|menor' then 0.4
          when a.number = 75 and a.body ilike '%la empresa est%obligada a%' and query.tsq::text ~ 'empresa' then 0.4
          when a.number = 76 and a.body ilike '%disposiciones especiales para personal en gestaci%' and query.tsq::text ~ 'gestacion|embaraz|lactanc' then 0.4
          when a.number = 76 and a.body ilike '%las violaciones al presente reglamento%' and query.tsq::text ~ 'violacion|sancion' then 0.4
          when a.number = 77 and a.body ilike '%los trabajadores est%n obligados a%' and query.tsq::text ~ 'trabajador|obligacion' then 0.4
          when a.number = 77 and a.body ilike '%el tipo de sanci%n se aplicar%' and query.tsq::text ~ 'gravedad|reincidencia' then 0.4
          when a.number = 78 and a.body ilike '%queda prohibido a los trabajadores%' and query.tsq::text ~ 'prohibi' then 0.4
          when a.number = 78 and a.body ilike '%durante el proceso de aplicaci%n de la sanci%n%' and query.tsq::text ~ 'sindicato' then 0.4
          else 0
        end
    ) as rank
  from reglamento_articles a,
       to_tsquery('spanish', replace(plainto_tsquery('spanish', q)::text, ' & ', ' | ')) query(tsq)
  where a.search @@ query.tsq and not a.excluded_from_chat
  order by rank desc
  limit 3;
$$;

grant execute on function search_reglamento(text) to anon, authenticated;

NOTIFY pgrst, 'reload schema';
