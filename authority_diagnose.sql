-- SCRIPT: DIAGNÓSTICO DE PODER (The Authority Check)
-- Verifica quién manda realmente y trata de forzar la puerta desde arriba.

-- 1. Ver de quién es miembro 'postgres' (tú)
SELECT 
    r2.rolname as superior_de_postgres,
    m.admin_option,
    m.grantor
FROM pg_auth_members m
JOIN pg_roles r1 ON m.member = r1.oid
JOIN pg_roles r2 ON m.roleid = r2.oid
WHERE r1.rolname = 'postgres';

-- 2. Ver cuáles son las únicas 4 funciones que quedaron en auth
-- (Esto nos dirá si el esquema está vacío o corrupto)
SELECT proname, proowner::regrole, pg_get_function_arguments(oid)
FROM pg_proc 
WHERE pronamespace = 'auth'::regnamespace;

-- 3. INTENTO DE FUERZA BRUTA (Asumiendo que postgres es miembro de supabase_admin)
DO $$
BEGIN
    BEGIN
        SET ROLE supabase_admin;
        RAISE NOTICE 'Intentando como supabase_admin...';
        GRANT USAGE ON SCHEMA auth TO authenticator, anon, authenticated, service_role;
        GRANT SELECT ON ALL TABLES IN SCHEMA auth TO authenticator, anon, authenticated, service_role;
        RESET ROLE;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Fallo como supabase_admin: %', SQLERRM;
        RESET ROLE;
    END;

    BEGIN
        SET ROLE supabase_auth_admin;
        RAISE NOTICE 'Intentando como supabase_auth_admin...';
        GRANT USAGE ON SCHEMA auth TO authenticator, anon, authenticated, service_role;
        RESET ROLE;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Fallo como supabase_auth_admin: %', SQLERRM;
        RESET ROLE;
    END;
END $$;

-- 4. Verificación final unificada
SELECT 
    rolname as rol,
    has_schema_privilege(rolname, 'auth', 'USAGE') as tiene_permiso
FROM pg_roles 
WHERE rolname IN ('authenticator', 'postgres', 'supabase_admin');
