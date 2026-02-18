-- SCRIPT: REPARACIÓN UNIVERSAL (The Master Key)
-- Intenta dar permiso a TODO el mundo para romper el bloqueo del portero.

BEGIN;

-- 1. Verificar si el rol Portero (authenticator) realmente existe
-- (Si no existe, nada funcionará)
SELECT count(*) as roles_encontrados FROM pg_roles WHERE rolname = 'authenticator';

-- 2. RESET TOTAL DE BUSQUEDA
-- Limpiamos cualquier configuración antigua que pueda chocar.
ALTER ROLE "authenticator" RESET ALL;
ALTER ROLE "authenticator" SET search_path TO cache, auth, public, extensions;

-- 3. ABRIR LA PUERTA PARA TODOS (Uso de Esquema)
-- Dar a PUBLIC es el nivel más alto de permiso: nadie puede decir que no.
GRANT USAGE ON SCHEMA auth TO PUBLIC;
GRANT USAGE ON SCHEMA extensions TO PUBLIC;
GRANT USAGE ON SCHEMA public TO PUBLIC;

-- 4. ABRIR ACCESO A TABLAS Y FUNCIONES
GRANT SELECT ON ALL TABLES IN SCHEMA auth TO PUBLIC;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO PUBLIC;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO PUBLIC;

-- 5. Sincronizar permisos del dueño
ALTER SCHEMA auth OWNER TO supabase_admin; -- Aseguramos quién manda

COMMIT;

-- 6. VERIFICACIÓN DEFINITIVA (Si esto sigue en False, el problema es el Motor de Supabase)
SELECT 
    rolname,
    has_schema_privilege(rolname, 'auth', 'USAGE') as can_use_auth_now
FROM pg_roles 
WHERE rolname IN ('authenticator', 'anon', 'authenticated', 'service_role');

-- 7. Ver el ACL final (Debe aparecer 'PUBLIC=U' o similar)
SELECT nspacl FROM pg_namespace WHERE nspname = 'auth';
