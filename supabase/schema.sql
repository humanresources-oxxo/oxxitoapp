-- Oxxito app schema: employees + reglamento articles + RPCs.
-- Run once in Supabase Dashboard -> SQL Editor -> New query -> Run.
-- See migration_02_roster.sql for the real-employee-roster follow-up.

create extension if not exists pgcrypto;

create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  numero_empleado text unique not null,
  nombre text not null,
  pin_hash text not null,
  notif_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists reglamento_articles (
  id serial primary key,
  article text not null,
  number int not null,
  body text not null,
  search tsvector generated always as (to_tsvector('spanish', body)) stored
);

create index if not exists reglamento_articles_search_idx on reglamento_articles using gin (search);

alter table employees enable row level security;
alter table reglamento_articles enable row level security;
-- No policies granted: anon/authenticated have zero direct table access.
-- All access goes through the security-definer functions below.

-- Look up an employee by number (used by Login to route to Verify vs Register,
-- and to greet by name). Empty result = not registered yet.
create or replace function employee_lookup(p_numero text)
returns table(nombre text)
language sql
security definer
set search_path = public
as $$
  select nombre from employees where numero_empleado = p_numero;
$$;

-- Create a new employee profile with a hashed PIN.
create or replace function register_employee(p_numero text, p_nombre text, p_pin text)
returns table(numero_empleado text, nombre text)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if exists (select 1 from employees e where e.numero_empleado = p_numero) then
    raise exception 'employee_already_exists';
  end if;

  return query
  insert into employees as e (numero_empleado, nombre, pin_hash)
  values (p_numero, p_nombre, crypt(p_pin, gen_salt('bf')))
  returning e.numero_empleado, e.nombre;
end;
$$;

-- Verify PIN for an existing employee.
create or replace function verify_pin(p_numero text, p_pin text)
returns table(numero_empleado text, nombre text)
language sql
security definer
set search_path = public, extensions
as $$
  select numero_empleado, nombre
  from employees
  where numero_empleado = p_numero
    and pin_hash = crypt(p_pin, pin_hash);
$$;

-- Keyword search over the real RIT text (Spanish full-text search, no LLM needed).
-- Uses OR between keywords (plainto_tsquery's default AND would require every
-- word in the question to appear in the article, which almost never happens).
create or replace function search_reglamento(q text)
returns table(article text, number int, body text, rank real)
language sql
security definer
set search_path = public
as $$
  select a.article, a.number, a.body, ts_rank(a.search, query.tsq) as rank
  from reglamento_articles a,
       to_tsquery('spanish', replace(plainto_tsquery('spanish', q)::text, ' & ', ' | ')) query(tsq)
  where a.search @@ query.tsq
  order by rank desc
  limit 3;
$$;

grant execute on function employee_lookup(text) to anon, authenticated;
grant execute on function register_employee(text, text, text) to anon, authenticated;
grant execute on function verify_pin(text, text) to anon, authenticated;
grant execute on function search_reglamento(text) to anon, authenticated;
