-- Migration 50: closes the public reads that migration 49 replaced. Run once
-- in Supabase SQL Editor, AFTER the app version that uses the sesion_* reads
-- is published (Cloudflare finished building main) and people have reopened
-- the app: a phone still running the old version loses the chat, the avisos
-- and the directory until it reloads.
--
-- BEFORE running it, check that nothing outside this repository still calls
-- these functions with the public key. The Panel Conoxxo (DashboardsOxxo
-- conoxxo.html) is the one to look at: if it lists avisos or contacts with
-- list_notices / list_avisos / list_directory_contacts, move it to
-- sesion_avisos / sesion_directorio first (it already has the session key).
--
-- The functions stay; only the public key can no longer run them. The
-- sesion_* functions run as their owner and keep calling them.

begin;

revoke execute on function search_reglamento(text) from public, anon, authenticated;
revoke execute on function list_sanciones(int) from public, anon, authenticated;
revoke execute on function get_sancion(int) from public, anon, authenticated;
revoke execute on function list_reglamento_items(int) from public, anon, authenticated;
revoke execute on function get_reglamento_item(int) from public, anon, authenticated;
revoke execute on function faq_reglamento_aprobadas() from public, anon, authenticated;
revoke execute on function search_faq(text) from public, anon, authenticated;
revoke execute on function list_avisos() from public, anon, authenticated;
revoke execute on function aviso_imagen(uuid) from public, anon, authenticated;
revoke execute on function list_notices() from public, anon, authenticated;
revoke execute on function list_directory_contacts() from public, anon, authenticated;

commit;

NOTIFY pgrst, 'reload schema';

-- To undo (the old app is still out there and something broke):
--   grant execute on function <name>(<args>) to anon, authenticated;
-- for each line above, then NOTIFY pgrst, 'reload schema';
