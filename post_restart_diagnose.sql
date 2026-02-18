-- SCRIPT: DIAGNÓSTICO POS-REINICIO (The Deep Scan)
-- Combina todo en una sola tabla para identificar la raíz del Error 500.

SELECT 
    (SELECT current_user) as usuario_actual,
    (SELECT has_schema_privilege('authenticator', 'auth', 'USAGE')) as portero_con_permiso,
    (SELECT count(*) FROM pg_views WHERE schemaname = 'auth') as total_vistas_auth,
    (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'auth') as total_funciones_auth,
    (SELECT 
        string_agg(plugin_name, ', ') 
        FROM (SELECT name as plugin_name FROM pg_available_extensions WHERE installed_version IS NOT NULL AND name IN ('pgcrypto', 'pg_net', 'pgjwt')) s
    ) as extensiones_activas,
    (SELECT nspacl::text FROM pg_namespace WHERE nspname = 'auth') as acl_crudo;

-- 2. Prueba individual de tablas críticas para ver cuál "explota"
DO $$
BEGIN
    BEGIN PERFORM count(*) FROM auth.users LIMIT 1; RAISE NOTICE 'TABLA_USERS: OK'; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'TABLA_USERS: FALLA - %', SQLERRM; END;
    BEGIN PERFORM count(*) FROM auth.identities LIMIT 1; RAISE NOTICE 'TABLA_IDENTITIES: OK'; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'TABLA_IDENTITIES: FALLA - %', SQLERRM; END;
    BEGIN PERFORM count(*) FROM auth.instances LIMIT 1; RAISE NOTICE 'TABLA_INSTANCES: OK'; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'TABLA_INSTANCES: FALLA - %', SQLERRM; END;
END $$;
