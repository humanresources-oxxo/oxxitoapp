-- Migration 06: let one admin passcode publish avisos from inside the app,
-- without building a full roles/permissions system for a single action.

create table if not exists admin_settings (
  key text primary key,
  value_hash text not null
);

alter table admin_settings enable row level security;
-- No policies: only reachable through the security-definer function below.

-- Replace REPLACE_WITH_REAL_PASSCODE below before running this migration.
-- (Already applied to the live project with the real passcode — this file
-- only documents the schema, it does not need to be re-run.)
insert into admin_settings (key, value_hash)
values ('notices_passcode', crypt('REPLACE_WITH_REAL_PASSCODE', gen_salt('bf')))
on conflict (key) do update set value_hash = excluded.value_hash;

create or replace function create_notice(
  p_passcode text,
  p_title text,
  p_body text,
  p_kind text,
  p_priority boolean
)
returns table(id text, title text, body text, kind text, priority boolean, published_at timestamptz)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  stored_hash text;
begin
  select value_hash into stored_hash from admin_settings where key = 'notices_passcode';

  if stored_hash is null or stored_hash <> crypt(p_passcode, stored_hash) then
    raise exception 'invalid_passcode';
  end if;

  return query
  insert into notices as n (title, body, kind, priority)
  values (p_title, p_body, p_kind, p_priority)
  returning n.id::text, n.title, n.body, n.kind, n.priority, n.published_at;
end;
$$;

grant execute on function create_notice(text, text, text, text, boolean) to anon, authenticated;

NOTIFY pgrst, 'reload schema';
