-- SCRIPT: DIAGNÓSTICO RUIDOSO (The Loud Fix)
-- Este script fallará a propósito para decirnos EXACTAMENTE qué está roto.

DO $$
DECLARE
    v_test text;
    v_instance_id uuid;
    v_crypt_check text;
BEGIN
    -- 1. PROBAR PGCRYPTO (Si falla aquí, ya sabemos la causa)
    BEGIN
        v_crypt_check := crypt('test', gen_salt('bf'));
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'CRÍTICO: La extensión pgcrypto NO funciona. Error: %', SQLERRM;
    END;

    -- 2. VERIFICAR ID DE INSTANCIA
    SELECT id INTO v_instance_id FROM auth.instances LIMIT 1;
    IF v_instance_id IS NULL THEN
        RAISE EXCEPTION 'CRÍTICO: No hay registros en auth.instances. Supabase está desconfigurado.';
    END IF;

    -- 3. PROBAR ACCESO AL ESQUEMA AUTH (como rol limitado)
    -- Esto simula lo que hace el login
    PERFORM count(*) FROM auth.users;
    
    RAISE NOTICE 'TODO PARECE CORRECTO EN EL MOTOR INTERNO.';
END $$;

-- 4. VER CONFIGURACIÓN DE ROL AUTHENTICATOR
SELECT 
    rolname, 
    rolconfig,
    rolcanlogin
FROM pg_roles 
WHERE rolname IN ('authenticator', 'supabase_admin');

-- 5. VER SI HAY POLÍTICAS (RLS) ROTAS EN AUTH.USERS
SELECT * FROM pg_policies WHERE schemaname = 'auth';

-- 6. VER ID DE INSTANCIA ACTUAL
SELECT id as INSTANCE_ID_REAL FROM auth.instances;
