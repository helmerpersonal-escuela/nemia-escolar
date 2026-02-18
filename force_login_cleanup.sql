-- SCRIPT: LIMPIEZA DE BLOQUEOS DE ESQUEMA (Emergency Fix)
-- Elimina triggers y funciones que puedan estar rotos o bloqueando el login.

BEGIN;

-- 1. Eliminar triggers sospechosos (God Mode Lockdown)
DROP TRIGGER IF EXISTS tr_enforce_super_admin ON public.profile_roles;
DROP TRIGGER IF EXISTS tr_enforce_super_admin_limit ON public.profile_roles;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 2. Eliminar funciones vinculadas (para asegurar que no haya errores de compilación)
DROP FUNCTION IF EXISTS public.enforce_super_admin_limit();
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 3. Reiniciar el estado del usuario una vez más (asegurando el ID de instancia)
-- Usamos el ID de instancia '0' que es el estándar de desarrollo de Supabase si el otro falla.
UPDATE auth.users 
SET instance_id = '00000000-0000-0000-0000-000000000000',
    aud = 'authenticated',
    role = 'authenticated',
    email_confirmed_at = NOW(),
    raw_app_meta_data = '{"provider": "email", "providers": ["email"]}',
    is_sso_user = false
WHERE email = 'helmerpersonal@gmail.com';

-- 4. Forzar recarga completa de PostgREST
NOTIFY pgrst, 'reload schema';

COMMIT;

-- 5. Confirmación final de limpieza
SELECT count(*) as active_custom_triggers
FROM information_schema.triggers 
WHERE event_object_schema = 'public' 
AND trigger_name LIKE '%enforce%';
