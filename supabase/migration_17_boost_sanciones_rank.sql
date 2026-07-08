-- Migration 17: "sanciones" alone wasn't ranking Art. 79 (the sanciones table)
-- as the top match, because it's a long article and ts_rank penalizes long
-- documents relative to short ones that also mention "sancion". Give Art. 79
-- an explicit boost whenever the query touches the word "sancion".

create or replace function search_reglamento(q text)
returns table(article text, number int, body text, rank real)
language sql
security definer
set search_path = public
as $$
  select a.article, a.number, a.body,
    (
      ts_rank(a.search, query.tsq)
      + case when a.number = 79 and query.tsq::text ~ 'sancion' then 0.5 else 0 end
    ) as rank
  from reglamento_articles a,
       to_tsquery('spanish', replace(plainto_tsquery('spanish', q)::text, ' & ', ' | ')) query(tsq)
  where a.search @@ query.tsq and not a.excluded_from_chat
  order by rank desc
  limit 3;
$$;

grant execute on function search_reglamento(text) to anon, authenticated;

NOTIFY pgrst, 'reload schema';
