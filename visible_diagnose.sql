-- SCRIPT: DIAGNÓSTICO VISIBLE (The Table Fix)
-- Este script guarda los resultados en una tabla para que los veas en 'Results'.

-- 1. Crear tabla temporal para los resultados
CREATE TEMP TABLE log_resultados (
    prueba TEXT,
    resultado TEXT,
    error_detalle TEXT
);

DO $$
DECLARE
    v_msg TEXT;
    v_err TEXT;
BEGIN
    -- Prueba 1: pgcrypto
    BEGIN
        PERFORM crypt('test', gen_salt('bf', 10));
        INSERT INTO log_resultados VALUES ('PGCRYPTO', 'EXITO', NULL);
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO log_resultados VALUES ('PGCRYPTO', 'FALLO', SQLERRM);
    END;

    -- Prueba 2: Acceso a auth.users
    BEGIN
        PERFORM count(*) FROM auth.users;
        INSERT INTO log_resultados VALUES ('ACCESO_AUTH_USERS', 'EXITO', NULL);
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO log_resultados VALUES ('ACCESO_AUTH_USERS', 'FALLO', SQLERRM);
    END;

    -- Prueba 3: Intentar GRANT a PUBLIC
    BEGIN
        EXECUTE 'GRANT USAGE ON SCHEMA auth TO PUBLIC';
        INSERT INTO log_resultados VALUES ('GRANT_PUBLIC', 'EXITO', NULL);
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO log_resultados VALUES ('GRANT_PUBLIC', 'FALLO', SQLERRM);
    END;

    -- Prueba 4: Verificar Search Path del authenticator
    INSERT INTO log_resultados 
    SELECT 'SEARCH_PATH_AUTH', 'VALOR', array_to_string(rolconfig, ', ') 
    FROM pg_roles WHERE rolname = 'authenticator';

END $$;

-- Mostrar todos los resultados acumulados
SELECT * FROM log_resultados;

-- Verificación de privilegios actual
SELECT 
    rolname as rol,
    has_schema_privilege(rolname, 'auth', 'USAGE') as tiene_permiso_auth
FROM pg_roles 
WHERE rolname IN ('authenticator', 'anon', 'authenticated');

-- Ver el ACL crudo una vez más
SELECT nspacl as acl_crudo FROM pg_namespace WHERE nspname = 'auth';
