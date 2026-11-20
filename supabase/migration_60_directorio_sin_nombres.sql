-- Migration 60: the directory shows the puesto, not the person's name.
-- Run once in Supabase SQL Editor, after 59.
--
-- - sesion_directorio (the app) no longer returns the name: the app shows the
--   puesto (role) as the title and the area below it. People change; the
--   puesto and its phone stay, and nobody's name is shown to the whole plaza.
-- - contacto_recuperar_pin ("Olvidé mi PIN", no session) gives the puesto too.
-- - The name becomes optional in the Panel Conoxxo; the puesto is required.
--   If RH writes a name, only the panel sees it (sesion_directorio_admin).
-- - sesion_directorio_admin: the panel's list of contacts. It read
--   list_directory_contacts, closed to the public key in migration 50, so the
--   panel showed "Sin contactos" since then.

begin;

create or replace function sesion_directorio(p_token text)
returns table(id text, name text, area text, role text, phone text, schedule text, tags text[], urgent boolean)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform sesion_exigir(p_token);
  return query select c.id, null::text, c.area, c.role, c.phone, c.schedule, c.tags, c.urgent from list_directory_contacts() c;
end;
$$;

create or replace function sesion_directorio_admin(p_token text)
returns table(id text, name text, area text, role text, phone text, schedule text, tags text[], urgent boolean)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  adm record;
begin
  select * into adm from sesion_admin(p_token);
  if adm.estado <> 'ok' then raise exception 'sesion_conoxxo'; end if;
  return query select c.id, c.name, c.area, c.role, c.phone, c.schedule, c.tags, c.urgent from list_directory_contacts() c;
end;
$$;

create or replace function contacto_recuperar_pin()
returns table(name text, phone text)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(nullif(trim(c.role), ''), 'Recepción de Recursos Humanos'), c.phone
  from directory_contacts c
  where 'recepcion' = any(c.tags)
  order by c.urgent desc, c.role asc
  limit 1;
$$;

create or replace function sesion_guardar_contacto(
  p_token text, p_id uuid, p_name text, p_area text, p_role text, p_phone text, p_schedule text, p_tags text[], p_urgent boolean
)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  adm record;
begin
  select * into adm from sesion_admin(p_token);
  if adm.estado <> 'ok' then
    return adm.estado;
  end if;
  -- The puesto is what the app shows; the name is optional (panel only).
  if char_length(trim(coalesce(p_role, ''))) < 2 or char_length(trim(coalesce(p_phone, ''))) < 7 then
    return 'datos_invalidos';
  end if;
  if p_id is null then
    insert into directory_contacts (name, area, role, phone, schedule, tags, urgent)
    values (trim(coalesce(p_name, '')), trim(coalesce(p_area, '')), trim(p_role), trim(p_phone), trim(coalesce(p_schedule, '')),
            coalesce(p_tags, '{}'), coalesce(p_urgent, false));
  else
    update directory_contacts
    set name = trim(coalesce(p_name, '')), area = trim(coalesce(p_area, '')), role = trim(p_role), phone = trim(p_phone),
        schedule = trim(coalesce(p_schedule, '')), tags = coalesce(p_tags, '{}'), urgent = coalesce(p_urgent, false)
    where id = p_id;
  end if;
  return 'ok';
end;
$$;

grant execute on function sesion_directorio(text) to anon, authenticated;
grant execute on function sesion_directorio_admin(text) to anon, authenticated;
grant execute on function contacto_recuperar_pin() to anon, authenticated;
grant execute on function sesion_guardar_contacto(text, uuid, text, text, text, text, text, text[], boolean) to anon, authenticated;

-- Contacts without a puesto (they would show only the area in the app): fill
-- their puesto in the panel.
select id, area, phone from directory_contacts where trim(coalesce(role, '')) = '';

commit;

NOTIFY pgrst, 'reload schema';
