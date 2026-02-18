-- 1. Asegurar extensión de encriptación
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Forzar actualización completa del usuario
UPDATE auth.users 
SET 
    encrypted_password = crypt('nemia2026', gen_salt('bf')),
    email_confirmed_at = COALESCE(email_confirmed_at, NOW()), -- Confirmar si no lo está
    confirmation_token = NULL,
    recovery_token = NULL,
    raw_app_meta_data = raw_app_meta_data || '{"provider": "email", "providers": ["email"]}'::jsonb
WHERE email = 'helmerpersonal@gmail.com';

-- 3. Verificar que se aplicó (debería devolver una fila)
SELECT id, email, email_confirmed_at FROM auth.users WHERE email = 'helmerpersonal@gmail.com';
