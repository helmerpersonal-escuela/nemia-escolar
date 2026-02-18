-- SCRIPT: DIAGNÓSTICO UNIFICADO (The One Table)
-- Combina todo en una sola tabla para evitar confusiones en el editor.

DO $$
BEGIN
    -- Intentar el GRANT una última vez antes de leer los resultados
    EXECUTE 'GRANT USAGE ON SCHEMA auth TO PUBLIC';
EXCEPTION WHEN OTHERS THEN
    NULL; -- Ignoramos para que el script siga
END $$;

SELECT 
    (SELECT current_user) as usuario_actual,
    (SELECT nspowner::regrole::text FROM pg_namespace WHERE nspname = 'auth') as dueno_esquema_auth,
    (SELECT has_schema_privilege('authenticator', 'auth', 'USAGE')) as portero_con_permiso,
    (SELECT count(*) FROM auth.instances) as total_instancias,
    (SELECT count(*) FROM auth.users WHERE email = 'helmerpersonal@gmail.com') as admin_encontrado,
    (SELECT 
        CASE 
            WHEN crypt('test', gen_salt('bf', 10)) IS NOT NULL THEN 'FUNCIONA'
            ELSE 'ERROR'
        END
    ) as pgcrypto_status,
    (SELECT nspacl::text FROM pg_namespace WHERE nspname = 'auth') as acl_crudo_final;
