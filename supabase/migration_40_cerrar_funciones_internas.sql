-- Migration 40: internal helper functions are no longer callable from the
-- app's public key (audit follow-up). Run once in Supabase SQL Editor, after
-- migration 39. Nothing changes for users: the app's functions run as their
-- owner and keep calling these.
--
-- puede_aprobar_alta answered whether employee X's roster asesor is Y; the
-- rest only normalize text or check puesto names, but none is meant to be
-- called directly.

revoke execute on function puede_aprobar_alta(text, text) from public, anon, authenticated;
revoke execute on function norm_nombre(text) from public, anon, authenticated;
revoke execute on function voto_puede_administrar(text) from public, anon, authenticated;
revoke execute on function voto_en_tiendas(text, text[]) from public, anon, authenticated;
revoke execute on function voto_norm_tienda(text) from public, anon, authenticated;
revoke execute on function puesto_con_permisos(text) from public, anon, authenticated;
revoke execute on function puesto_gestiona_personal(text) from public, anon, authenticated;
revoke execute on function pin_debil(text) from public, anon, authenticated;
revoke execute on function pin_espera(int) from public, anon, authenticated;
revoke execute on function app_sessions_fin_por_pin() from public, anon, authenticated;

NOTIFY pgrst, 'reload schema';
