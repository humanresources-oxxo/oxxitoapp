-- NOTE (later): no longer used. Contratos colectivos now live in DashboardsOxxo's
-- Apps Script (publicarCct / consultarCct, v63) so the admin panel needs no
-- extra passcode; see src/services/cct.ts. Migration 33 drops all of this.
-- Migration 32: contratos colectivos (CCT) for the app-only "Contratos
-- colectivos" screen. RH uploads the CCT Excel ("Data colectiva Tiendas OXXO")
-- from DashboardsOxxo's admin panel (Administrativo, js/cct-conoxxo.js), which
-- shows it in no dashboard; the panel turns each row into indicators only (no
-- names of responsables, no SharePoint links) and replaces the whole table.
--   hoja 'historico' = sheet "CCTs Tiendas" (one row per plaza and year)
--   hoja 'ejercicio' = sheet "CCT ejercicio <año>" (current year, with compliance)
-- The data is not in the dashboards' public Google Sheet. Like the other
-- tables of the app, it is read through an RPC with the publishable key.

create table if not exists cct_contratos (
  id bigserial primary key,
  hoja text not null check (hoja in ('historico', 'ejercicio')),
  datos jsonb not null,
  archivo text,
  cargado_el timestamptz not null default now()
);

-- No policies: only the security definer functions below touch the table.
alter table cct_contratos enable row level security;

create or replace function list_cct()
returns table(hoja text, datos jsonb, archivo text, cargado_el timestamptz)
language sql
security definer
set search_path = public
as $$
  select c.hoja, c.datos, c.archivo, c.cargado_el from cct_contratos c order by c.id;
$$;

-- Replaces everything with p_filas: [{ "hoja": "historico" | "ejercicio", "datos": {...} }, ...]
create or replace function admin_replace_cct(p_passcode text, p_filas jsonb, p_archivo text default null)
returns int
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  total int;
begin
  if not admin_check_passcode(p_passcode) then
    raise exception 'invalid_passcode';
  end if;
  if jsonb_typeof(p_filas) <> 'array' or jsonb_array_length(p_filas) = 0 then
    raise exception 'sin_filas';
  end if;

  delete from cct_contratos;
  insert into cct_contratos (hoja, datos, archivo)
  select f ->> 'hoja', f -> 'datos', nullif(p_archivo, '')
  from jsonb_array_elements(p_filas) f;
  get diagnostics total = row_count;
  return total;
end;
$$;

grant execute on function list_cct() to anon, authenticated;
grant execute on function admin_replace_cct(text, jsonb, text) to anon, authenticated;

NOTIFY pgrst, 'reload schema';
