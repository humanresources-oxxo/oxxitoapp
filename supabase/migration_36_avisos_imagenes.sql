-- Migration 36: avisos with images, and deleting avisos from the app.
-- Run once in Supabase SQL Editor, after migration 35.
--
-- Up to 3 images per aviso, compressed on the phone (JPEG, longest side
-- 1280 px) and stored as Base64 in notice_images; the app loads each one
-- with aviso_imagen when it shows it. An aviso with images can go without
-- text (a flyer). Publishing and deleting use the session key and the
-- puestos of migration 35 (RH and Gerente de plaza).
-- list_notices and create_notice stay as they were for the admin web panel.

create table if not exists notice_images (
  id uuid primary key default gen_random_uuid(),
  notice_id uuid not null references notices(id) on delete cascade,
  orden int not null,
  mime text not null check (mime in ('image/jpeg', 'image/png', 'image/webp')),
  width int not null check (width between 1 and 4096),
  height int not null check (height between 1 and 4096),
  -- Base64, at most ~1 MB of image.
  data text not null check (char_length(data) <= 1400000)
);
create index if not exists notice_images_notice on notice_images(notice_id);
alter table notice_images enable row level security;
-- No policies: only reachable through the security-definer functions below.

-- Avisos with their images' ids and sizes (not the data: aviso_imagen).
create or replace function list_avisos()
returns table(id text, title text, body text, kind text, priority boolean, published_at timestamptz, imagenes jsonb)
language sql
security definer
set search_path = public
as $$
  select n.id::text, n.title, n.body, n.kind, n.priority, n.published_at,
    coalesce((
      select jsonb_agg(jsonb_build_object('id', i.id::text, 'width', i.width, 'height', i.height) order by i.orden)
      from notice_images i where i.notice_id = n.id
    ), '[]'::jsonb)
  from notices n
  order by n.published_at desc
  limit 50;
$$;

create or replace function aviso_imagen(p_id uuid)
returns table(mime text, data text)
language sql
security definer
set search_path = public
as $$
  select i.mime, i.data from notice_images i where i.id = p_id;
$$;

-- p_imagenes: [{mime, data (Base64), width, height}], at most 3.
-- Returns 'ok' | 'no_session' | 'not_allowed' | 'bad_notice' | 'bad_image'.
drop function if exists sesion_publicar_aviso(text, text, text, text, boolean);
create or replace function sesion_publicar_aviso(
  p_token text,
  p_title text,
  p_body text,
  p_kind text,
  p_priority boolean,
  p_imagenes jsonb default '[]'::jsonb
)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  adm record;
  imgs jsonb := coalesce(p_imagenes, '[]'::jsonb);
  nuevo uuid;
begin
  select * into adm from sesion_admin(p_token);
  if adm.estado <> 'ok' then
    return adm.estado;
  end if;

  if jsonb_typeof(imgs) <> 'array' or jsonb_array_length(imgs) > 3 or exists (
    select 1 from jsonb_array_elements(imgs) x
    where coalesce(x->>'mime', '') not in ('image/jpeg', 'image/png', 'image/webp')
       or coalesce(x->>'data', '') !~ '^[A-Za-z0-9+/]+={0,2}$'
       or char_length(x->>'data') > 1400000
       or (case when coalesce(x->>'width', '') ~ '^[0-9]{1,4}$' then (x->>'width')::int else 0 end) not between 1 and 4096
       or (case when coalesce(x->>'height', '') ~ '^[0-9]{1,4}$' then (x->>'height')::int else 0 end) not between 1 and 4096
  ) then
    return 'bad_image';
  end if;

  if char_length(trim(coalesce(p_title, ''))) < 3
     or (char_length(trim(coalesce(p_body, ''))) < 3 and jsonb_array_length(imgs) = 0)
     or p_kind not in ('policy', 'training', 'schedule', 'benefit') then
    return 'bad_notice';
  end if;

  insert into notices (title, body, kind, priority)
  values (trim(p_title), trim(coalesce(p_body, '')), p_kind, coalesce(p_priority, false))
  returning notices.id into nuevo;

  insert into notice_images (notice_id, orden, mime, width, height, data)
  select nuevo, n, x->>'mime', (x->>'width')::int, (x->>'height')::int, x->>'data'
  from jsonb_array_elements(imgs) with ordinality as u(x, n);

  return 'ok';
end;
$$;

-- Returns 'ok' | 'no_session' | 'not_allowed'. Its images go with it.
create or replace function sesion_borrar_aviso(p_token text, p_id uuid)
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
  delete from notices where id = p_id;
  return 'ok';
end;
$$;

grant execute on function list_avisos() to anon, authenticated;
grant execute on function aviso_imagen(uuid) to anon, authenticated;
grant execute on function sesion_publicar_aviso(text, text, text, text, boolean, jsonb) to anon, authenticated;
grant execute on function sesion_borrar_aviso(text, uuid) to anon, authenticated;

NOTIFY pgrst, 'reload schema';
