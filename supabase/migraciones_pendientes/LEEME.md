# Migraciones que NO se aplicaron a producción

Se sacaron de `supabase/migrations/` el 23/09/2026 para que un `supabase db push`
no las ejecute por accidente. Revisa cada una antes de decidir qué hacer.

| Archivo | Qué hace | Recomendación |
|---|---|---|
| `20260223093000_prepare_for_production.sql` | **BORRA todas las escuelas, perfiles, suscripciones y usuarios** (excepto el Super Admin) | ⛔ No aplicar nunca en producción. Solo sirve para reiniciar un entorno de pruebas. |
| `20260223100000_consolidated_production_setup.sql` | Cambia FKs a CASCADE **y también borra todos los datos** | ⛔ No aplicar. La parte de FKs ya está en producción. |
| `20260223135500_force_cascade_deletion.sql` | Cambia a CASCADE/SET NULL todas las FKs hacia usuarios y perfiles | ⚠️ Útil para borrar cuentas, pero amplía lo que se borra en cascada. Revisar. |

**Resueltas el 23/09/2026:** las dos versiones de `handle_new_user` (121500 y 123500) quedaron reemplazadas por `migrations/20260923160000_invitations_and_signup_hardening.sql`; se movieron a `_archivo/migraciones-descartadas/` junto con `repair_current_workspace` y el archivo vacío de telesecundaria.

Pendientes que SÍ son seguras y siguen en `migrations/`: los datos de ejemplo de
plantillas (`20260222210001_seed_templates.sql`, `20260222210002_expanded_templates.sql`).
Se aplican con `npx supabase db push`.
