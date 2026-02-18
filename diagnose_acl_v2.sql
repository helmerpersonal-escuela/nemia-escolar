-- SCRIPT: EL CERROJO INVISIBLE (ACL Deep Dive)
-- Este script busca por qué los permisos no se quedan grabados.

-- 1. Ver qué privilegios tiene asignados el esquema (El ACL)
SELECT 
    n.nspname as schema,
    pg_catalog.pg_get_userbyid(n.nspowner) as owner,
    n.nspacl as access_permissions -- ESTO ES LO MÁS IMPORTANTE
FROM pg_catalog.pg_namespace n
WHERE n.nspname = 'auth';

-- 2. Ver quién eres tú ahora mismo
SELECT current_user as soy_el_usuario, is_superuser;

-- 3. Intentar un RESET AGRESIVO de permisos
-- Si somos superusuarios, esto debería funcionar.
DO $$
BEGIN
    -- Intentar tomar posesión del esquema si es necesario
    -- EXECUTE 'ALTER SCHEMA auth OWNER TO ' || quote_ident(current_user);
    
    -- Dar permisos a todo el mundo que importa
    EXECUTE 'GRANT USAGE ON SCHEMA auth TO anon, authenticated, authenticator, service_role';
    EXECUTE 'GRANT ALL ON ALL TABLES IN SCHEMA auth TO anon, authenticated, authenticator, service_role';
    EXECUTE 'GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO anon, authenticated, authenticator, service_role';
    EXECUTE 'GRANT ALL ON ALL FUNCTIONS IN SCHEMA auth TO anon, authenticated, authenticator, service_role';
    
    RAISE NOTICE 'Permisos re-aplicados.';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error al aplicar permisos: %', SQLERRM;
END $$;

-- 4. Verificación final (¿Cambió a TRUE?)
SELECT has_schema_privilege('authenticator', 'auth', 'USAGE') as check_authenticator;
