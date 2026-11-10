-- Migration 44: preguntas frecuentes del reglamento (RIT), propuestas por
-- Claude Haiku y revisadas por RH. Run once in Supabase SQL Editor, after 43.
--
-- Flow:
-- 1. In the Panel Conoxxo (DashboardsOxxo conoxxo.html, tab "Preguntas
--    frecuentes"), RH presses "Generar propuestas con IA". The app's Worker
--    (worker/faq.js) reads the articles a few at a time with the session
--    (sesion_reglamento_articulos), Haiku writes questions and answers from
--    each article, and they are saved as 'propuesta' (sesion_faq_proponer).
-- 2. RH approves, edits or discards each one (sesion_faq_lista,
--    sesion_faq_revisar).
-- 3. Only 'aprobada' ones are public: the chat's suggestions
--    (faq_reglamento_aprobadas) and the context Haiku gets when answering
--    (search_faq).
-- Everything that writes or reads proposals needs a session of someone who
-- manages personnel (empleado_gestiona_personal: RH puestos and
-- accesos_especiales).

begin;

create table if not exists reglamento_faq (
  id bigserial primary key,
  articulo int not null,
  pregunta text not null check (char_length(pregunta) between 5 and 300),
  respuesta text not null check (char_length(respuesta) between 5 and 1500),
  estado text not null default 'propuesta' check (estado in ('propuesta', 'aprobada', 'descartada')),
  creado_en timestamptz not null default now(),
  revisado_por text,
  revisado_en timestamptz,
  search tsvector generated always as (to_tsvector('spanish', pregunta || ' ' || respuesta)) stored
);
create index if not exists reglamento_faq_search_idx on reglamento_faq using gin (search);
create index if not exists reglamento_faq_estado_idx on reglamento_faq (estado);
alter table reglamento_faq enable row level security;
-- No policies: only the functions below touch it.

-- Articles for generating proposals, in order, from p_desde (at most 10).
create or replace function sesion_reglamento_articulos(p_token text, p_desde int, p_limite int)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  numero text := sesion_empleado(p_token);
begin
  if numero is null then return jsonb_build_object('estado', 'no_session'); end if;
  if not empleado_gestiona_personal(numero) then return jsonb_build_object('estado', 'not_allowed'); end if;
  return jsonb_build_object('estado', 'ok', 'articulos', coalesce((
    select jsonb_agg(jsonb_build_object('number', a.number, 'article', a.article, 'body', a.body) order by a.number)
    from (
      select r.number, r.article, r.body from reglamento_articles r
      where r.number >= coalesce(p_desde, 0) and not r.excluded_from_chat
      order by r.number
      limit least(greatest(coalesce(p_limite, 8), 1), 10)
    ) a
  ), '[]'::jsonb));
end;
$$;

-- Save proposals: p_items = [{articulo, pregunta, respuesta}, ...] (max 60).
-- An identical question already saved for that article is skipped.
create or replace function sesion_faq_proponer(p_token text, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  numero text := sesion_empleado(p_token);
  it jsonb;
  n int := 0;
begin
  if numero is null then return jsonb_build_object('estado', 'no_session'); end if;
  if not empleado_gestiona_personal(numero) then return jsonb_build_object('estado', 'not_allowed'); end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 60 then return jsonb_build_object('estado', 'invalid'); end if;
  for it in select * from jsonb_array_elements(p_items) loop
    if (it->>'articulo') ~ '^\d+$'
       and char_length(trim(coalesce(it->>'pregunta', ''))) between 5 and 300
       and char_length(trim(coalesce(it->>'respuesta', ''))) between 5 and 1500
       and exists (select 1 from reglamento_articles r where r.number = (it->>'articulo')::int)
       and not exists (
         select 1 from reglamento_faq f
         where f.articulo = (it->>'articulo')::int and lower(f.pregunta) = lower(trim(it->>'pregunta'))
       ) then
      insert into reglamento_faq (articulo, pregunta, respuesta)
      values ((it->>'articulo')::int, trim(it->>'pregunta'), trim(it->>'respuesta'));
      n := n + 1;
    end if;
  end loop;
  return jsonb_build_object('estado', 'ok', 'guardadas', n);
end;
$$;

-- All of them, for RH's review (proposals first).
create or replace function sesion_faq_lista(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  numero text := sesion_empleado(p_token);
begin
  if numero is null then return jsonb_build_object('estado', 'no_session'); end if;
  if not empleado_gestiona_personal(numero) then return jsonb_build_object('estado', 'not_allowed'); end if;
  return jsonb_build_object('estado', 'ok', 'faq', coalesce((
    select jsonb_agg(jsonb_build_object('id', f.id, 'articulo', f.articulo, 'pregunta', f.pregunta, 'respuesta', f.respuesta,
      'estado', f.estado, 'revisado_en', f.revisado_en)
      order by case f.estado when 'propuesta' then 0 when 'aprobada' then 1 else 2 end, f.articulo, f.id)
    from reglamento_faq f
  ), '[]'::jsonb));
end;
$$;

-- Approve / discard (and optionally edit the text) one question.
create or replace function sesion_faq_revisar(p_token text, p_id bigint, p_estado text, p_pregunta text, p_respuesta text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  numero text := sesion_empleado(p_token);
begin
  if numero is null then return 'no_session'; end if;
  if not empleado_gestiona_personal(numero) then return 'not_allowed'; end if;
  if p_estado not in ('propuesta', 'aprobada', 'descartada') then return 'invalid'; end if;
  if p_pregunta is not null and char_length(trim(p_pregunta)) not between 5 and 300 then return 'invalid'; end if;
  if p_respuesta is not null and char_length(trim(p_respuesta)) not between 5 and 1500 then return 'invalid'; end if;
  update reglamento_faq
  set estado = p_estado,
      pregunta = coalesce(nullif(trim(p_pregunta), ''), pregunta),
      respuesta = coalesce(nullif(trim(p_respuesta), ''), respuesta),
      revisado_por = numero,
      revisado_en = now()
  where id = p_id;
  if not found then return 'not_found'; end if;
  return 'ok';
end;
$$;

-- Public: approved questions (chat suggestions).
create or replace function faq_reglamento_aprobadas()
returns table(id bigint, articulo int, pregunta text, respuesta text)
language sql
stable
security definer
set search_path = public
as $$
  select f.id, f.articulo, f.pregunta, f.respuesta from reglamento_faq f where f.estado = 'aprobada' order by f.articulo, f.id;
$$;

-- Public: approved questions closest to a question (context for the chat).
create or replace function search_faq(q text)
returns table(id bigint, articulo int, pregunta text, respuesta text, rank real)
language sql
stable
security definer
set search_path = public
as $$
  select f.id, f.articulo, f.pregunta, f.respuesta, ts_rank(f.search, query.tsq) as rank
  from reglamento_faq f,
       to_tsquery('spanish', replace(plainto_tsquery('spanish', q)::text, ' & ', ' | ')) query(tsq)
  where f.estado = 'aprobada' and f.search @@ query.tsq
  order by rank desc
  limit 3;
$$;

revoke all on table reglamento_faq from public, anon, authenticated;
grant execute on function sesion_reglamento_articulos(text, int, int) to anon, authenticated;
grant execute on function sesion_faq_proponer(text, jsonb) to anon, authenticated;
grant execute on function sesion_faq_lista(text) to anon, authenticated;
grant execute on function sesion_faq_revisar(text, bigint, text, text, text) to anon, authenticated;
grant execute on function faq_reglamento_aprobadas() to anon, authenticated;
grant execute on function search_faq(text) to anon, authenticated;

commit;

NOTIFY pgrst, 'reload schema';
