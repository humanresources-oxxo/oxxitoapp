-- Migration 10: remove free self-registration entirely. New hires are added
-- to the roster directly by an admin (via SQL/seed script), never through
-- the app itself.

drop function if exists register_employee(text, text, text);

NOTIFY pgrst, 'reload schema';
