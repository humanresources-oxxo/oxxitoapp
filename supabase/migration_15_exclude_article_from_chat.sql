-- Migration 15: Art. 79 (sanciones) is a table in the original PDF that
-- extracted as garbled run-on text (columns interleaved into one paragraph).
-- Keep the row (it's real regulatory content, not ours to delete), just stop
-- the chat search from ever surfacing it as an answer.

alter table reglamento_articles add column if not exists excluded_from_chat boolean not null default false;

update reglamento_articles set excluded_from_chat = true where number = 79;

create or replace function search_reglamento(q text)
returns table(article text, number int, body text, rank real)
language sql
security definer
set search_path = public
as $$
  select a.article, a.number, a.body, ts_rank(a.search, query.tsq) as rank
  from reglamento_articles a,
       to_tsquery('spanish', replace(plainto_tsquery('spanish', q)::text, ' & ', ' | ')) query(tsq)
  where a.search @@ query.tsq and not a.excluded_from_chat
  order by rank desc
  limit 3;
$$;

grant execute on function search_reglamento(text) to anon, authenticated;

NOTIFY pgrst, 'reload schema';
