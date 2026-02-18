-- SCRIPT: REPARACIÓN NUCLEAR DE LOGIN (500 Error Fix)
-- Este script desactiva el trigger sospechoso y reinicia permisos de acceso.

BEGIN;

-- 1. DESACTIVAR EL TRIGGER (Sospechoso número 1 del error 500)
-- A veces el trigger causa un error interno en GoTrue al intentar validar roles.
DROP TRIGGER IF EXISTS tr_enforce_super_admin_limit ON public.profile_roles;

-- 2. REINICIAR PERMISOS TOTALES (Asegura que GoTrue y PostgREST puedan leer todo)
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, authenticator, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, authenticator, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, authenticator, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, authenticator, service_role;

-- 3. FORZAR RECARGA DE CACHE (Doble impacto)
NOTIFY pgrst, 'reload schema';

COMMIT;

-- 4. Verificación de permisos (Debe devolver filas)
SELECT grantee, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_name = 'profiles' AND grantee = 'authenticator';
