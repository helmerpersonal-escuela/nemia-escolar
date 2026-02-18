-- SCRIPT: SIMULACIÓN DE LOGIN (The Impersonator)
-- Este script intenta "actuar" como el sistema para ver dónde se rompe el permiso.

DO $$
BEGIN
    -- 1. Probar qué ve el rol 'authenticator' (el portero)
    SET ROLE authenticator;
    RAISE NOTICE 'Probando acceso como authenticator...';
    
    PERFORM count(*) FROM auth.users;
    RAISE NOTICE 'Acceso a auth.users: OK';
    
    PERFORM count(*) FROM auth.identities;
    RAISE NOTICE 'Acceso a auth.identities: OK';
    
    PERFORM count(*) FROM auth.instances;
    RAISE NOTICE 'Acceso a auth.instances: OK';

    -- 2. Probar si puede usar pgcrypto (para validar contraseñas)
    BEGIN
        PERFORM crypt('test', gen_salt('bf'));
        RAISE NOTICE 'Uso de pgcrypto: OK';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Uso de pgcrypto: FALLIDO - %', SQLERRM;
    END;

    RESET ROLE;
EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    RAISE EXCEPTION 'ERROR DE PERMISOS DETECTADO: %', SQLERRM;
END $$;

-- 3. Ver si existen VISTAS rotas en auth (esto da 500 directo)
SELECT 
    table_name, 
    is_insertable_into 
FROM information_schema.tables 
WHERE table_schema = 'auth' AND table_type = 'VIEW';

-- 4. Forzar el dueño de TODO el esquema auth a supabase_admin (de nuevo, por seguridad)
REASSIGN OWNED BY postgres TO supabase_admin; -- Si algo quedó como postgres
ALTER SCHEMA auth OWNER TO supabase_admin;
ALTER SCHEMA public OWNER TO postgres;
