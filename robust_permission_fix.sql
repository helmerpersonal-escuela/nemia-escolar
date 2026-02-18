-- SCRIPT: REPARACIÓN ROBUSTA DE PERMISOS (The Final Master Key)
-- Evita modificar roles reservados y se enfoca en el esquema y sus funciones.

BEGIN;

-- 1. Intentar otorgar permisos al esquema con comillas dobles para evitar ambigüedades
GRANT USAGE ON SCHEMA "auth" TO "authenticator";
GRANT USAGE ON SCHEMA "auth" TO "anon";
GRANT USAGE ON SCHEMA "auth" TO "authenticated";
GRANT USAGE ON SCHEMA "auth" TO "service_role";

-- 2. Otorgar SELECT en todas las tablas existentes
GRANT SELECT ON ALL TABLES IN SCHEMA "auth" TO "authenticator", "anon", "authenticated", "service_role";

-- 3. Resetear el Search Path (esto no suele estar bloqueado por ser 'reserved')
ALTER ROLE "authenticator" SET search_path TO cache, auth, public, extensions;

-- 4. REPARACIÓN DE FUNCIONES (Crítico para el error 500)
-- A veces las funciones internas de Auth pierden el permiso de ejecución.
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA "auth" TO "authenticator", "anon", "authenticated", "service_role";
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA "extensions" TO "authenticator", "anon", "authenticated", "service_role";

-- 5. Asegurar que el dueño de las funciones sea supabase_auth_admin o supabase_admin
-- (Esto arregla problemas de SECURITY DEFINER)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT proname, nspname 
              FROM pg_proc p 
              JOIN pg_namespace n ON p.pronamespace = n.oid 
              WHERE n.nspname = 'auth') 
    LOOP
        EXECUTE 'ALTER FUNCTION auth.' || quote_ident(r.proname) || ' OWNER TO supabase_admin';
    END LOOP;
END $$;

COMMIT;

-- VERIFICACIÓN DEFINITIVA
SELECT 
    nspname as schema,
    nspacl as raw_acl,
    has_schema_privilege('authenticator', 'auth', 'USAGE') as authenticator_ok
FROM pg_namespace 
WHERE nspname = 'auth';
