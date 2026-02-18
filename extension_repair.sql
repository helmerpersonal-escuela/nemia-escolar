-- SCRIPT: REANIMACIÓN ESTRUCTURAL (The Extension Fix)
-- Intenta re-instalar las piezas del motor que faltan.

BEGIN;

-- 1. Asegurar que las extensiones vitales existan
-- (Sin estas, GoTrue explota con Error 500)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pg_net" SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgjwt" SCHEMA extensions;

-- 2. Verificar si ahora aparecen
SELECT name, installed_version 
FROM pg_available_extensions 
WHERE name IN ('pgcrypto', 'pg_net', 'pgjwt', 'uuid-ossp');

-- 3. Intentar devolverle el poder al portero ahora que las extensiones están volviendo
GRANT USAGE ON SCHEMA auth TO anon, authenticated, authenticator, service_role;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, authenticator, service_role;

COMMIT;

-- 4. Verificación de salud
SELECT 
    (SELECT count(*) FROM pg_proc WHERE pronamespace = 'auth'::regnamespace) as funciones_en_auth,
    (SELECT has_schema_privilege('authenticator', 'auth', 'USAGE')) as portero_curado;
