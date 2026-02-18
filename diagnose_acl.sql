-- SCRIPT: DIAGNÓSTICO DE ACL (The Hidden Lock)
-- Busca entender por qué el GRANT no está funcionando.

-- 1. Ver quién soy en esta sesión
SELECT session_user, current_user;

-- 2. Ver los permisos reales (ACL) del esquema auth
SELECT nspname, nspacl 
FROM pg_namespace 
WHERE nspname IN ('auth', 'public', 'extensions');

-- 3. Ver qué roles tiene el usuario actual
SELECT 
    r.rolname, 
    ARRAY(SELECT b.rolname
          FROM pg_auth_members m
          JOIN pg_roles b ON (m.roleid = b.oid)
          WHERE m.member = r.oid) as member_of
FROM pg_roles r
WHERE r.rolname = current_user;

-- 4. Intentar un GRANT con una técnica diferente
-- Si el error 500 persiste y sale 'false', intentaremos dar permiso al rol 'postgres' 
-- y ver si lo hereda, aunque lo ideal es directo a 'authenticator'.
DO $$
BEGIN
    EXECUTE 'GRANT USAGE ON SCHEMA auth TO anon, authenticated, authenticator';
    EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA auth TO anon, authenticated, authenticator';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error intentando GRANT: %', SQLERRM;
END $$;

-- Verificación inmediata
SELECT has_schema_privilege('authenticator', 'auth', 'USAGE') as check_authenticator;
