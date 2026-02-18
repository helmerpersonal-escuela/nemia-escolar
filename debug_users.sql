-- SCRIPT: DIAGNÓSTICO DE USUARIOS
-- Lista los últimos 5 usuarios registrados para ver quién está realmente en la base de datos.

SELECT 
    id, 
    email, 
    created_at, 
    last_sign_in_at 
FROM auth.users 
ORDER BY created_at DESC 
LIMIT 5;
