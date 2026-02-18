-- SCRIPT: REPARACIÓN FINAL DE ESQUEMA (The Door Opener)
-- Otorga los permisos de uso que el rol 'authenticator' necesita desesperadamente.

BEGIN;

-- 1. Otorga permiso de USO al esquema auth (La raíz del Error 500)
GRANT USAGE ON SCHEMA auth TO anon, authenticated, authenticator;

-- 2. Otorga permisos de LECTURA en las tablas críticas de auth
-- (Para que GoTrue pueda verificar usuarios e identidades)
GRANT SELECT ON ALL TABLES IN SCHEMA auth TO anon, authenticated, authenticator;

-- 3. Asegurar que esto aplique a futuras tablas (por si acaso)
ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT SELECT ON TABLES TO anon, authenticated, authenticator;

-- 4. Un toque extra de seguridad para el search_path
-- (Aseguramos que el Portero sepa dónde buscar de nuevo)
ALTER ROLE authenticator SET search_path TO cache, auth, public, extensions;

COMMIT;

-- Verificación de la reparación (Debe decir 't' de True)
SELECT has_schema_privilege('authenticator', 'auth', 'USAGE') as authenticator_can_use_auth;
