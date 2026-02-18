-- SCRIPT: RESET NUCLEAR DE ACL (The Final Key)
-- Este script intenta romper cualquier bloqueo de metadatos en el esquema auth.

BEGIN;

-- 1. Asegurar que el dueño es el administrador del sistema
-- (Si el dueño actual es 'postgres' o algún otro, lo normalizamos)
ALTER SCHEMA auth OWNER TO supabase_admin;

-- 2. Limpieza total de permisos (Tabula Rasa)
REVOKE ALL ON SCHEMA auth FROM PUBLIC;
REVOKE ALL ON SCHEMA auth FROM anon, authenticated, authenticator, service_role;

-- 3. Re-asignación agresiva de permisos
GRANT USAGE ON SCHEMA auth TO anon, authenticated, authenticator, service_role, supabase_admin;
GRANT SELECT ON ALL TABLES IN SCHEMA auth TO anon, authenticated, authenticator, service_role, supabase_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO anon, authenticated, authenticator, service_role, supabase_admin;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA auth TO anon, authenticated, authenticator, service_role, supabase_admin;

-- 4. Unir el Search Path de nuevo (por si se perdió)
ALTER ROLE authenticator SET search_path TO cache, auth, public, extensions;

-- 5. Forzar recarga de PostgREST
NOTIFY pgrst, 'reload schema';

COMMIT;

-- VERIFICACIÓN CRÍTICA (Pásame estos resultados si sale False)
SELECT 
    nspacl as raw_acl,
    has_schema_privilege('authenticator', 'auth', 'USAGE') as can_use_auth_now,
    has_schema_privilege('authenticated', 'auth', 'USAGE') as can_authenticated_use_auth
FROM pg_namespace 
WHERE nspname = 'auth';
