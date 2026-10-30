-- Migration 30: Sofia Caridad Jimenez Gomez (1567089) is no longer with the
-- team (ASESOR TIENDA in migration 22, no longer in Catalogo_Asesores). She is
-- removed from the roster, so she can't log in again; the app also closes any
-- session she still has open the next time it starts (MainTabsNavigator checks
-- the roster on open). If she comes back, add her again from the admin panel.

delete from employees where numero_empleado = '1567089';
