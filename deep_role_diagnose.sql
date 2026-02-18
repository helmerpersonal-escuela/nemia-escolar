-- SCRIPT: DIAGNÓSTICO DE ROL Y RUTA (The Invisible Wall)
-- Busca si el rol 'authenticator' tiene prohibido ver el esquema.

-- 1. Ver configuración exacta de los roles de Auth
SELECT 
    rolname, 
    rolconfig,
    rolcanlogin,
    rolconnlimit
FROM pg_roles 
WHERE rolname IN ('authenticator', 'authenticated', 'anon', 'supabase_admin');

-- 2. Ver el Search Path actual de la sesión
SHOW search_path;

-- 3. Ver permisos de búsqueda en esquemas críticos
SELECT 
    n.nspname as schema_name,
    has_schema_privilege('authenticator', n.nspname, 'USAGE') as authenticator_has_usage,
    has_schema_privilege('authenticated', n.nspname, 'USAGE') as authenticated_has_usage
FROM pg_namespace n
WHERE n.nspname IN ('auth', 'public', 'extensions');

-- 4. ¿Hay algún objeto "huérfano" en auth.users?
-- (Usuarios que tengan un instance_id que NO esté en auth.instances)
SELECT id, email, instance_id 
FROM auth.users 
WHERE instance_id NOT IN (SELECT id FROM auth.instances);

-- 5. Probar una consulta de autenticación manual como el sistema
-- Esto nos dirá si el error es a nivel de base de datos puro.
SELECT count(*) FROM auth.users WHERE aud = 'authenticated';
