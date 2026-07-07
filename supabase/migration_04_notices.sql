-- Migration 04: real (empty for now) notices table, replacing hardcoded mock avisos.
-- Run once in Supabase SQL Editor after migration_03_pin_lockout.sql.

create table if not exists notices (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  kind text not null check (kind in ('policy', 'training', 'schedule', 'benefit')),
  priority boolean not null default false,
  published_at timestamptz not null default now()
);

alter table notices enable row level security;
-- No policies granted: content is read-only for the app, via the function below.

create or replace function list_notices()
returns table(id text, title text, body text, kind text, priority boolean, published_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select n.id::text, n.title, n.body, n.kind, n.priority, n.published_at
  from notices n
  order by n.published_at desc
  limit 50;
$$;

grant execute on function list_notices() to anon, authenticated;

NOTIFY pgrst, 'reload schema';
