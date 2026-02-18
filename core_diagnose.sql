-- SCRIPT: DIAGNÓSTICO DE JERARQUÍA Y MENSAJES (The Core Investigation)
-- Este script es CRÍTICO para ver por qué el portero no tiene llaves.

-- 1. Ver de quién es miembro el 'authenticator'
SELECT 
    r2.rolname as es_miembro_de,
    m.admin_option,
    m.grantor
FROM pg_auth_members m
JOIN pg_roles r1 ON m.member = r1.oid
JOIN pg_roles r2 ON m.roleid = r2.oid
WHERE r1.rolname = 'authenticator';

-- 2. Prueba De Fuego (Míralo en la pestaña 'Messages' de Supabase)
DO $$
BEGIN
    -- Prueba pgcrypto
    BEGIN
        PERFORM crypt('test', gen_salt('bf'));
        RAISE NOTICE 'PRUEBA_PGCRYPTO: EXITO';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'PRUEBA_PGCRYPTO: FALLO - %', SQLERRM;
    END;

    -- Prueba acceso a tablas como el usuario actual
    BEGIN
        PERFORM count(*) FROM auth.users;
        RAISE NOTICE 'PRUEBA_AUTH_USERS: EXITO';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'PRUEBA_AUTH_USERS: FALLO - %', SQLERRM;
    END;

    -- Prueba de Grant a PUBLIC
    BEGIN
        EXECUTE 'GRANT USAGE ON SCHEMA auth TO PUBLIC';
        RAISE NOTICE 'PRUEBA_GRANT_PUBLIC: EXITO';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'PRUEBA_GRANT_PUBLIC: FALLO - %', SQLERRM;
    END;
END $$;

-- 3. Ver el Search Path actual de este editor
SHOW search_path;

-- 4. Ver quién es el dueño real de las tablas de auth
SELECT tablename, tableowner FROM pg_tables WHERE schemaname = 'auth';
