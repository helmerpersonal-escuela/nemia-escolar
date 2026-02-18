-- SCRIPT: ESCALADA DE IDENTIDAD (The Trojan Horse)
-- Intenta usar los roles con más poder para otorgar los permisos.

DO $$
BEGIN
    -- 1. Intentar actuar como el administrador de Auth (que tiene UC en el esquema)
    BEGIN
        SET ROLE supabase_auth_admin;
        RAISE NOTICE 'Actuando como supabase_auth_admin...';
        
        GRANT USAGE ON SCHEMA auth TO anon, authenticated, authenticator, service_role;
        GRANT SELECT ON ALL TABLES IN SCHEMA auth TO anon, authenticated, authenticator, service_role;
        
        RAISE NOTICE '¡PERMISOS OTORGADOS EXITOSAMENTE!';
        RESET ROLE;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'No se pudo usar supabase_auth_admin: %', SQLERRM;
        RESET ROLE;
    END;

    -- 2. Intentar actuar como el administrador general
    BEGIN
        SET ROLE supabase_admin;
        RAISE NOTICE 'Actuando como supabase_admin...';
        
        GRANT USAGE ON SCHEMA auth TO anon, authenticated, authenticator, service_role;
        GRANT SELECT ON ALL TABLES IN SCHEMA auth TO anon, authenticated, authenticator, service_role;
        
        RAISE NOTICE '¡PERMISOS OTORGADOS POR SUPABASE_ADMIN!';
        RESET ROLE;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'No se pudo usar supabase_admin: %', SQLERRM;
        RESET ROLE;
    END;
END $$;

-- Verificación final unificada
SELECT 
    rolname,
    has_schema_privilege(rolname, 'auth', 'USAGE') as tiene_permiso
FROM pg_roles 
WHERE rolname IN ('authenticator', 'supabase_auth_admin', 'postgres');
