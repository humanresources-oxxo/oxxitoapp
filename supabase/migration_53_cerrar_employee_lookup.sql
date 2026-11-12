-- Migration 53: closes employee_lookup, replaced in migration 52. Run once in
-- Supabase SQL Editor, AFTER the app version that uses acceso_empleado /
-- sesion_mi_perfil is published and people have reopened the app.
--
-- A phone still running the old version cannot start a NEW login until it
-- reloads (it says "No pudimos conectar"); someone already inside keeps their
-- session, because a failed check keeps the saved one.
--
-- BEFORE running it, check that nothing outside this repository calls
-- employee_lookup with the public key (the Panel Conoxxo in DashboardsOxxo,
-- the Apps Script).
--
-- The function stays; only the public key can no longer run it.

revoke execute on function employee_lookup(text) from public, anon, authenticated;

NOTIFY pgrst, 'reload schema';

-- To undo:
--   grant execute on function employee_lookup(text) to anon, authenticated;
--   NOTIFY pgrst, 'reload schema';
