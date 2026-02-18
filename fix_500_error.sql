-- SCRIPT: FIX DEFINITIVO ERROR 500 (Sincronización de Instancia)
-- Este script arregla el desajuste de IDs que causa el error de GoTrue.

BEGIN;

-- 1. Asegurar pgcrypto (Vital para el hashing de contraseñas)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Sincronizar instance_id (El error 500 suele ser por esto)
-- Actualiza tu usuario con el ID real de la base de datos de este proyecto
UPDATE auth.users 
SET instance_id = (SELECT id FROM auth.instances LIMIT 1)
WHERE email = 'helmerpersonal@gmail.com';

-- 3. Re-generar contraseña limpia (Por si el hash se corrompió)
UPDATE auth.users 
SET encrypted_password = crypt('nemia2026', gen_salt('bf'))
WHERE email = 'helmerpersonal@gmail.com';

-- 4. Asegurar confirmación de email
UPDATE auth.users 
SET email_confirmed_at = NOW(),
    updated_at = NOW()
WHERE email = 'helmerpersonal@gmail.com';

COMMIT;

-- Verificación final
SELECT id, email, instance_id FROM auth.users WHERE email = 'helmerpersonal@gmail.com';
SELECT id as real_instance_id FROM auth.instances;
