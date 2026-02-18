-- SCRIPT: REPARACIÓN DE LLAVES MAESTRAS (The Role Fix)
-- Este script re-instala los permisos de los roles internos para acabar con el Error 500.

BEGIN;

-- 1. Forzar Search Path para que el sistema encuentre el esquema Auth
-- Esto le dice a Supabase: "Cuando busques usuarios, mira primero en el esquema auth"
ALTER ROLE authenticator SET search_path TO cache, auth, public, extensions;
ALTER ROLE authenticated SET search_path TO cache, auth, public, extensions;
ALTER ROLE anon SET search_path TO cache, auth, public, extensions;

-- 2. Asegurar permisos de USAGE (Derecho a entrar a los esquemas)
GRANT USAGE ON SCHEMA auth TO anon, authenticated, authenticator;
GRANT USAGE ON SCHEMA public TO anon, authenticated, authenticator;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, authenticator;

-- 3. Asegurar que las contraseñas se puedan verificar
-- (Damos acceso a las funciones de pgcrypto)
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO anon, authenticated, authenticator;

-- 4. Un último toque al ID de Instancia por si acaso
-- (Aseguramos que no haya nulos en campos obligatorios)
UPDATE auth.users 
SET 
  instance_id = '00000000-0000-0000-0000-000000000000',
  aud = 'authenticated',
  role = 'authenticated'
WHERE email = 'helmerpersonal@gmail.com' 
AND (instance_id IS NULL OR aud IS NULL OR role IS NULL);

COMMIT;

-- Verificación de la reparación
SHOW search_path;
SELECT rolname, rolconfig FROM pg_roles WHERE rolname = 'authenticator';
