-- Migration 27: clear PIN for every employee who already had one, so
-- everyone goes through the new email-verification gate on their next
-- "crear PIN" (explicit, user-requested, affects all active accounts).
update employees
set pin_hash = null,
    pin_is_temporary = false,
    failed_attempts = 0,
    locked_until = null,
    pending_email_verified_until = null
where pin_hash is not null;
