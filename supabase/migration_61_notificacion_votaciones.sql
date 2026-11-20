-- Migration 61: notification of a new votación on the phone.
-- Run once in Supabase SQL Editor, after 60.
--
-- Same mechanism as the avisos (migration 58): whoever creates the votación
-- (sesion_admin) asks the Worker to send it in batches; each batch is claimed
-- here before sending (ultima_votacion), so nobody gets it twice. Only the
-- newest open votación created in the last 30 minutes. A votación for some
-- stores only reaches the phones of employees of those stores (voto_en_tiendas,
-- the same rule that decides who can vote).

begin;

alter table push_suscripciones add column if not exists ultima_votacion uuid;

-- Same as 58, plus: a phone that turns notifications on now does not get the
-- votación already open.
create or replace function sesion_push_guardar(p_token text, p_endpoint text, p_p256dh text, p_auth text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  numero text := sesion_empleado(p_token);
  ultimo uuid;
  ultima_v uuid;
begin
  if numero is null then return 'no_session'; end if;
  if not push_endpoint_valido(p_endpoint)
     or coalesce(p_p256dh, '') !~ '^[A-Za-z0-9_-]{86,88}={0,2}$'
     or coalesce(p_auth, '') !~ '^[A-Za-z0-9_-]{21,24}={0,2}$' then
    return 'invalid';
  end if;
  select n.id into ultimo from notices n order by n.published_at desc limit 1;
  select v.id into ultima_v from votaciones v order by v.creada_en desc limit 1;
  insert into push_suscripciones (endpoint, p256dh, auth, numero_empleado, ultimo_aviso, ultima_votacion)
  values (p_endpoint, p_p256dh, p_auth, numero, ultimo, ultima_v)
  on conflict (endpoint) do update
    set p256dh = excluded.p256dh, auth = excluded.auth, numero_empleado = excluded.numero_empleado, creada = now();
  delete from push_suscripciones s
  where s.numero_empleado = numero
    and s.endpoint not in (select x.endpoint from push_suscripciones x where x.numero_empleado = numero order by x.creada desc limit 5);
  return 'ok';
end;
$$;

-- Next batch of phones for the newest votación (only who may create them).
-- { estado: 'ok', votacion: {id, titulo}, destinos: [...], quedan } | { estado: 'sin_votacion' }
create or replace function sesion_push_lote_votacion(p_token text, p_limite int)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  adm record;
  v record;
  destinos jsonb;
  quedan int;
begin
  select * into adm from sesion_admin(p_token);
  if adm.estado <> 'ok' then return jsonb_build_object('estado', adm.estado); end if;

  select x.id, x.titulo, x.tiendas, x.creada_en into v
  from votaciones x
  where x.cerrada_en is null and x.cierra_en > now()
  order by x.creada_en desc limit 1;
  if v.id is null or v.creada_en < now() - interval '30 minutes' then
    return jsonb_build_object('estado', 'sin_votacion');
  end if;

  delete from push_suscripciones s where not exists (select 1 from employees e where e.numero_empleado = s.numero_empleado);

  with elegidas as (
    select s.endpoint from push_suscripciones s
    join employees e on e.numero_empleado = s.numero_empleado
    where s.ultima_votacion is distinct from v.id
      and voto_en_tiendas(e.tienda, v.tiendas)
    order by s.endpoint
    limit least(greatest(coalesce(p_limite, 0), 1), 40)
    for update of s skip locked
  ), marcadas as (
    update push_suscripciones s set ultima_votacion = v.id, ultimo_envio = now()
    from elegidas el where s.endpoint = el.endpoint
    returning s.endpoint, s.p256dh, s.auth
  )
  select coalesce(jsonb_agg(jsonb_build_object('endpoint', endpoint, 'p256dh', p256dh, 'auth', auth)), '[]'::jsonb) into destinos from marcadas;

  select count(*) into quedan
  from push_suscripciones s join employees e on e.numero_empleado = s.numero_empleado
  where s.ultima_votacion is distinct from v.id and voto_en_tiendas(e.tienda, v.tiendas);

  return jsonb_build_object('estado', 'ok', 'votacion', jsonb_build_object('id', v.id, 'titulo', v.titulo), 'destinos', destinos, 'quedan', quedan);
end;
$$;

grant execute on function sesion_push_guardar(text, text, text, text) to anon, authenticated;
grant execute on function sesion_push_lote_votacion(text, int) to anon, authenticated;

commit;

NOTIFY pgrst, 'reload schema';
