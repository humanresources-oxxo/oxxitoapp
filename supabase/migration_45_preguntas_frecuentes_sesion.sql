-- Migration 45: fixes migration 44. Run once in Supabase SQL Editor.
--
-- sesion_reglamento_articulos and sesion_faq_lista were marked STABLE, but they
-- call sesion_empleado, which renews the session (an UPDATE). PostgREST runs
-- STABLE functions in a read-only transaction, so both failed with "cannot
-- execute UPDATE in a read-only transaction" (the panel stopped at article 1
-- and the list stayed empty). Like every other sesion_* function, they must
-- be VOLATILE (the default).

alter function sesion_reglamento_articulos(text, int, int) volatile;
alter function sesion_faq_lista(text) volatile;

NOTIFY pgrst, 'reload schema';
