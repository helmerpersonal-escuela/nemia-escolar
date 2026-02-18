-- SCRIPT: REVELACIÓN TOTAL (The Meta Scan)
-- Consolida membresía de roles y lista de funciones en una sola tabla.

WITH 
roles_info AS (
    SELECT string_agg(r2.rolname, ', ') as superiores
    FROM pg_auth_members m
    JOIN pg_roles r1 ON m.member = r1.oid
    JOIN pg_roles r2 ON m.roleid = r2.oid
    WHERE r1.rolname = 'postgres'
),
functions_info AS (
    SELECT string_agg(proname, ', ') as funciones_auth
    FROM pg_proc 
    WHERE pronamespace = 'auth'::regnamespace
)
SELECT 
    (SELECT superiores FROM roles_info) as postgres_es_miembro_de,
    (SELECT funciones_auth FROM functions_info) as funciones_restantes_auth,
    (SELECT count(*) FROM pg_tables WHERE schemaname = 'auth') as total_tablas_auth,
    (SELECT has_schema_privilege('authenticator', 'auth', 'USAGE')) as portero_tiene_permiso,
    (SELECT nspacl::text FROM pg_namespace WHERE nspname = 'auth') as acl_crudo_auth;
