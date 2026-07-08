-- Migration 21: migration_20's disambiguation boost never fired because it
-- checked for full words ('trabajador', 'obligacion', etc.) but Postgres'
-- Spanish stemmer truncates much more aggressively ('trabaj', 'oblig',
-- 'grav', 'prohib', 'sindicat'...). Verified the real stems via a temp debug
-- RPC. Fix the regex patterns to match the actual stems, and drop the debug
-- function.

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
          when a.number = 75 and a.body ilike '%labores insalubres%' and query.tsq::text ~ 'insalubr|peligr|gestacion|menor' then 0.4
          when a.number = 75 and a.body ilike '%la empresa est%obligada a%' and query.tsq::text ~ 'empres' then 0.4
          when a.number = 76 and a.body ilike '%disposiciones especiales para personal en gestaci%' and query.tsq::text ~ 'gestacion|embaraz|lactanci' then 0.4
          when a.number = 76 and a.body ilike '%las violaciones al presente reglamento%' and query.tsq::text ~ 'violacion|sancion' then 0.4
          when a.number = 77 and a.body ilike '%los trabajadores est%n obligados a%' and query.tsq::text ~ 'trabaj|oblig' then 0.4
          when a.number = 77 and a.body ilike '%el tipo de sanci%n se aplicar%' and query.tsq::text ~ 'grav|reincident' then 0.4
          when a.number = 78 and a.body ilike '%queda prohibido a los trabajadores%' and query.tsq::text ~ 'prohib' then 0.4
          when a.number = 78 and a.body ilike '%durante el proceso de aplicaci%n de la sanci%n%' and query.tsq::text ~ 'sindicat' then 0.4
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

drop function if exists debug_temp(text);

NOTIFY pgrst, 'reload schema';
