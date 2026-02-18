-- SCRIPT: DIAGNÓSTICO DE HERENCIA (The Missing Link)
-- Busca ver si 'authenticator' es hijo de alguien o si está aislado.

-- 1. Ver membresías de roles
-- (Queremos saber si authenticator tiene a anon/authenticated como padres)
SELECT 
    r1.rolname as role,
    r2.rolname as member_of,
    m.admin_option
FROM pg_auth_members m
JOIN pg_roles r1 ON m.member = r1.oid
JOIN pg_roles r2 ON m.roleid = r2.oid
WHERE r1.rolname IN ('authenticator', 'authenticated', 'anon', 'service_role');

-- 2. Intentar la "Herencia Forzosa"
-- Si authenticator hereda de authenticated, ya debería tener permiso.
BEGIN;
GRANT authenticated TO authenticator;
GRANT anon TO authenticator;
ALTER ROLE authenticator INHERIT;
COMMIT;

-- 3. Verificación de privilegios heredados
SELECT 
    has_schema_privilege('authenticator', 'auth', 'USAGE') as can_authenticator_use_auth,
    has_schema_privilege('authenticated', 'auth', 'USAGE') as can_authenticated_use_auth;

-- 4. Ver si hay algún "DENY" explícito (poco común pero posible)
SELECT * FROM pg_roles WHERE rolname = 'authenticator';
