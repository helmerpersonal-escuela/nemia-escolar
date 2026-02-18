-- DIAGRNOSTICO DE USUARIO
-- Ejecuta esto y dime si devuelve una fila o "No Data"

SELECT 
    id, 
    email, 
    role, 
    email_confirmed_at, 
    instance_id,
    created_at,
    last_sign_in_at,
    raw_user_meta_data
FROM auth.users 
WHERE email = 'helmerpersonal@gmail.com';

-- Verificar si hay otros usuarios para comparar el instance_id
SELECT instance_id, email FROM auth.users LIMIT 5;
