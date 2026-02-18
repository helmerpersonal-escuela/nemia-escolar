-- SCRIPT: DIAGNÓSTICO DE CREDENCIALES (Final Countdown)
-- Verifica por qué GoTrue rechaza la contraseña.

-- 1. Ver el detalle técnico completo del usuario
SELECT 
    id, 
    email, 
    aud, 
    role, 
    email_confirmed_at, 
    confirmed_at, 
    is_sso_user,
    instance_id,
    encrypted_password
FROM auth.users 
WHERE email = 'helmerpersonal@gmail.com';

-- 2. Asegurar que el aud sea 'authenticated'
-- (Si está vacío o es otra cosa, GoTrue da 400)
UPDATE auth.users 
SET aud = 'authenticated', 
    role = 'authenticated'
WHERE email = 'helmerpersonal@gmail.com';

-- 3. Resetear contraseña con el formato exacto de Supabase
-- Usamos 10 rondas para el salt (estándar de Supabase)
UPDATE auth.users 
SET encrypted_password = crypt('nemia2026', gen_salt('bf', 10))
WHERE email = 'helmerpersonal@gmail.com';
