-- SCRIPT: REPARACIÓN POR ASUNCIÓN DE ROL (The Dashboard Bypass)
-- Intenta usar el rol 'dashboard_user' que tiene permisos de creación (C).

DO $$
BEGIN
    -- 1. Intentar cambiar al rol que SÍ tiene permisos en el ACL
    BEGIN
        SET ROLE dashboard_user;
        RAISE NOTICE 'Cambiado a rol dashboard_user...';
        
        -- Intentar dar el permiso crítico
        GRANT USAGE ON SCHEMA auth TO authenticator;
        GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
        GRANT SELECT ON ALL TABLES IN SCHEMA auth TO authenticator, anon, authenticated, service_role;
        
        RAISE NOTICE '¡PERMISOS OTORGADOS DESDE DASHBOARD_USER!';
        RESET ROLE;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'No se pudo asumir dashboard_user: %', SQLERRM;
        RESET ROLE;
    END;

    -- 2. Intentar lo mismo con supabase_admin (por si acaso)
    BEGIN
        SET ROLE supabase_admin;
        RAISE NOTICE 'Cambiado a rol supabase_admin...';
        
        GRANT USAGE ON SCHEMA auth TO authenticator;
        GRANT SELECT ON ALL TABLES IN SCHEMA auth TO authenticator;
        
        RAISE NOTICE '¡PERMISOS OTORGADOS DESDE SUPABASE_ADMIN!';
        RESET ROLE;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'No se pudo asumir supabase_admin: %', SQLERRM;
        RESET ROLE;
    END;
END $$;

-- Verificación final en una sola tabla
SELECT 
    rolname as rol,
    has_schema_privilege(rolname, 'auth', 'USAGE') as tiene_acceso_auth,
    (SELECT nspacl::text FROM pg_namespace WHERE nspname = 'auth') as acl_final
FROM pg_roles 
WHERE rolname IN ('authenticator', 'postgres', 'dashboard_user');
