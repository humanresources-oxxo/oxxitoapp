-- Migration 49: the reglamento, the avisos and the directory are read with the
-- session key. Run once in Supabase SQL Editor, after 48 and BEFORE publishing
-- the app version that uses it.
--
-- Until now search_reglamento, list_sanciones, get_sancion,
-- list_reglamento_items, get_reglamento_item, faq_reglamento_aprobadas,
-- search_faq, list_avisos, aviso_imagen, list_notices and
-- list_directory_contacts answered to the public key that ships in the web
-- bundle: anyone holding it could read the RIT ("Uso Interno"), the avisos and
-- the directory phones without being an employee.
--
-- This migration only ADDS the sesion_* twins below: same rows, but they first
-- check the session key (sesion_empleado) and fail with 'sesion_conoxxo'
-- without one, which is what the app already understands as "ask for the PIN
-- once". Nothing is closed here, so the published app keeps working.
-- migration_50_cerrar_lecturas_publicas.sql closes the old ones once the new
-- app is out.
--
-- Like every sesion_* function they are VOLATILE: sesion_empleado renews the
-- session with an UPDATE (see migration 45).

begin;

-- Stops with 'sesion_conoxxo' unless p_token is a valid session key.
create or replace function sesion_exigir(p_token text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if sesion_empleado(p_token) is null then
    raise exception 'sesion_conoxxo';
  end if;
end;
$$;

-- === Reglamento ===
create or replace function sesion_buscar_reglamento(p_token text, q text)
returns table(article text, number int, body text, rank real)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform sesion_exigir(p_token);
  return query select s.article, s.number, s.body, s.rank from search_reglamento(q) s;
end;
$$;

create or replace function sesion_lista_sanciones(p_token text, p_article int default 79)
returns table(id int, infraccion text)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform sesion_exigir(p_token);
  return query select s.id, s.infraccion from list_sanciones(p_article) s;
end;
$$;

create or replace function sesion_sancion(p_token text, p_id int)
returns table(id int, infraccion text, pasos text[], article_number int)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform sesion_exigir(p_token);
  return query select s.id, s.infraccion, s.pasos, s.article_number from get_sancion(p_id) s;
end;
$$;

create or replace function sesion_lista_items(p_token text, p_article int)
returns table(id int, label text)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform sesion_exigir(p_token);
  return query select i.id, i.label from list_reglamento_items(p_article) i;
end;
$$;

create or replace function sesion_item(p_token text, p_id int)
returns table(id int, label text, body text, article_number int)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform sesion_exigir(p_token);
  return query select i.id, i.label, i.body, i.article_number from get_reglamento_item(p_id) i;
end;
$$;

-- === Preguntas frecuentes aprobadas ===
create or replace function sesion_faq_aprobadas(p_token text)
returns table(id bigint, articulo int, pregunta text, respuesta text)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform sesion_exigir(p_token);
  return query select f.id, f.articulo, f.pregunta, f.respuesta from faq_reglamento_aprobadas() f;
end;
$$;

create or replace function sesion_buscar_faq(p_token text, q text)
returns table(id bigint, articulo int, pregunta text, respuesta text, rank real)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform sesion_exigir(p_token);
  return query select f.id, f.articulo, f.pregunta, f.respuesta, f.rank from search_faq(q) f;
end;
$$;

-- === Avisos ===
create or replace function sesion_avisos(p_token text)
returns table(id text, title text, body text, kind text, priority boolean, published_at timestamptz, imagenes jsonb)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform sesion_exigir(p_token);
  return query select a.id, a.title, a.body, a.kind, a.priority, a.published_at, a.imagenes from list_avisos() a;
end;
$$;

create or replace function sesion_aviso_imagen(p_token text, p_id uuid)
returns table(mime text, data text)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform sesion_exigir(p_token);
  return query select i.mime, i.data from aviso_imagen(p_id) i;
end;
$$;

-- === Directorio ===
create or replace function sesion_directorio(p_token text)
returns table(id text, name text, area text, role text, phone text, schedule text, tags text[], urgent boolean)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform sesion_exigir(p_token);
  return query select c.id, c.name, c.area, c.role, c.phone, c.schedule, c.tags, c.urgent from list_directory_contacts() c;
end;
$$;

-- The one thing that stays public: who to call to recover a PIN. The login
-- screen ("Olvidé mi PIN") shows it to someone who, by definition, has no
-- session. Only the RH reception contact, only its name and phone.
create or replace function contacto_recuperar_pin()
returns table(name text, phone text)
language sql
stable
security definer
set search_path = public
as $$
  select c.name, c.phone
  from directory_contacts c
  where 'recepcion' = any(c.tags)
  order by c.urgent desc, c.name asc
  limit 1;
$$;

revoke execute on function sesion_exigir(text) from public, anon, authenticated;
grant execute on function sesion_buscar_reglamento(text, text) to anon, authenticated;
grant execute on function sesion_lista_sanciones(text, int) to anon, authenticated;
grant execute on function sesion_sancion(text, int) to anon, authenticated;
grant execute on function sesion_lista_items(text, int) to anon, authenticated;
grant execute on function sesion_item(text, int) to anon, authenticated;
grant execute on function sesion_faq_aprobadas(text) to anon, authenticated;
grant execute on function sesion_buscar_faq(text, text) to anon, authenticated;
grant execute on function sesion_avisos(text) to anon, authenticated;
grant execute on function sesion_aviso_imagen(text, uuid) to anon, authenticated;
grant execute on function sesion_directorio(text) to anon, authenticated;
grant execute on function contacto_recuperar_pin() to anon, authenticated;

commit;

NOTIFY pgrst, 'reload schema';
