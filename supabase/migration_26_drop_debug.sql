-- Migration 26: drop the temporary debug helper used to confirm Brevo
-- actually delivered the verification email (it did - 201 Created).
drop function if exists debug_net_response();

NOTIFY pgrst, 'reload schema';
