-- Migration 55: closes list_votaciones, replaced in migration 54. Run once in
-- Supabase SQL Editor, AFTER the app version that uses sesion_votaciones is
-- published. Paste the WHOLE file and run it with nothing selected (the SQL
-- Editor runs only the selected text when there is a selection).
--
-- A phone still running the old version shows "no se pudieron cargar las
-- votaciones" and hides the Inicio card until it reloads.
--
-- The function stays; only the public key can no longer run it.

revoke execute on function list_votaciones(text) from public, anon, authenticated;

NOTIFY pgrst, 'reload schema';

-- It worked if this returns no rows:
select p.oid::regprocedure as sigue_abierta
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  and p.proname = 'list_votaciones'
  and has_function_privilege('anon', p.oid, 'execute');

-- To undo:
--   grant execute on function list_votaciones(text) to anon, authenticated;
--   NOTIFY pgrst, 'reload schema';
