-- Migration 33: remove what migration 32 created for contratos colectivos.
-- The contracts now live in DashboardsOxxo's Apps Script (publicarCct /
-- consultarCct, v63) and the app reads them from there (src/services/cct.ts),
-- so the table and its two functions are no longer used by anything.

drop function if exists admin_replace_cct(text, jsonb, text);
drop function if exists list_cct();
drop table if exists cct_contratos;

NOTIFY pgrst, 'reload schema';
