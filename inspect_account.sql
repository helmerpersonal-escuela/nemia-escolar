-- SCRIPT: INSPECCIÓN TOTAL DE CUENTA (Deep Dive)
-- Busca cualquier campo que GoTrue use para rechazar el login.

SELECT 
    id, 
    email, 
    aud, 
    role, 
    instance_id,
    is_sso_user,
    is_super_admin, -- Algunos esquemas tienen esto
    confirmed_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_anonymous,
    deleted_at
FROM auth.users 
WHERE email = 'helmerpersonal@gmail.com';

-- Verificar si hay bloqueos por intentos fallidos
-- (GoTrue puede banear IPs o correos temporalmente)
-- Aunque esto no se suele ver fácil en tablas, podemos ver si hay 'banned_until'
SELECT banned_until FROM auth.users WHERE email = 'helmerpersonal@gmail.com';
