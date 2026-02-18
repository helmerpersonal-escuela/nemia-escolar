-- SCRIPT: EL CERROJO INVISIBLE V3 (Role & ACL Deep Dive)
-- Busca entender por qué los permisos no se quedan grabados y quién tiene el control.

-- 1. Ver qué privilegios tiene asignados el esquema (El ACL)
SELECT 
    n.nspname as schema,
    pg_catalog.pg_get_userbyid(n.nspowner) as owner,
    n.nspacl as access_permissions
FROM pg_catalog.pg_namespace n
WHERE n.nspname = 'auth';

-- 2. Ver quién eres tú y tus propiedades de superusuario
SELECT 
    rolname, 
    rolsuper as is_superuser,
    rolcreaterole as can_create_role,
    rolcreatedb as can_create_db
FROM pg_roles 
WHERE rolname = current_user;

-- 3. Ver todos los miembros del esquema auth
-- Esto nos dirá si alguien más tiene bloqueada la puerta.
SELECT 
    grantee, 
    privilege_type, 
    is_grantable
FROM information_schema.usage_privileges 
WHERE object_name = 'auth' AND object_type = 'SCHEMA';

-- 4. Intentar el GRANT de nuevo pero con diagnóstico de error individual
DO $$
BEGIN
    EXECUTE 'GRANT USAGE ON SCHEMA auth TO anon';
    RAISE NOTICE 'Grant a anon: OK';
    EXECUTE 'GRANT USAGE ON SCHEMA auth TO authenticated';
    RAISE NOTICE 'Grant a authenticated: OK';
    EXECUTE 'GRANT USAGE ON SCHEMA auth TO authenticator';
    RAISE NOTICE 'Grant a authenticator: OK';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'FALLO EN EL GRANT: % (Código: %)', SQLERRM, SQLSTATE;
END $$;

-- 5. Verificación final de USAGE
SELECT has_schema_privilege('authenticator', 'auth', 'USAGE') as can_authenticator_use_auth;
