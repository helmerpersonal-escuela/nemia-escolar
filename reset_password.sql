-- Activa la extensión pgcrypto si no está activa
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Fuerza la contraseña del Super Admin
UPDATE auth.users 
SET encrypted_password = crypt('nemia2026', gen_salt('bf')) 
WHERE email = 'helmerpersonal@gmail.com';

-- Confirma que el usuario existe y muestra su ID (opcional)
SELECT id, email, encrypted_password FROM auth.users WHERE email = 'helmerpersonal@gmail.com';
