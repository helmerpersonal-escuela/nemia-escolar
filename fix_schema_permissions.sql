-- SCRIPT: REPARACIÓN DE ERROR DE SCHEMA (Login 500)
-- Ejecuta esto si obtienes "Database error querying schema" al intentar loguearte.

BEGIN;

-- 1. Forzar recarga de caché de Schema (CRÍTICO después de cambios manuales en auth)
NOTIFY pgrst, 'reload schema';

-- 2. Asegurar permisos básicos para el rol 'authenticated' y 'anon'
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

-- 3. Asegurar que el usuario tenga el rol correcto en la sesión
-- (Esto no cambia datos, solo asegura que los policies funcionen)
ALTER ROLE authenticated SET search_path = public, auth;

COMMIT;

-- 4. Verificación rápida (Opcional, solo para confirmar que la DB está viva)
SELECT count(*) as total_users FROM auth.users;
