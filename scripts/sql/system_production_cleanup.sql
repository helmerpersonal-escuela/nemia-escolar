-- ==========================================
-- PRODUCTION CLEANUP SCRIPT
-- ==========================================
-- Objetivo: Eliminar todos los datos de prueba y usuarios, 
-- dejando solo a helmerferras@gmail.com como SUPER_ADMIN global.

BEGIN;

-- Desactivar triggers temporalmente para evitar errores de integridad durante la limpieza masiva
SET session_replication_role = 'replica';

-- 1. Eliminar todos los datos de aplicación (Tenants, Escuelas, Alumnos, etc.)
-- Esto cascada a la mayoría de las tablas si están bien configuradas.
TRUNCATE public.tenants CASCADE;

-- 2. Eliminar todos los usuarios de Auth excepto el Super Admin
DELETE FROM auth.users 
WHERE email IS DISTINCT FROM 'helmerferras@gmail.com';

-- 3. Limpiar el perfil del Super Admin para que sea GLOBAL (sin tenant_id)
UPDATE public.profiles 
SET tenant_id = NULL 
WHERE id IN (SELECT id FROM auth.users WHERE email = 'helmerferras@gmail.com');

-- 4. Asegurar que el Super Admin tenga el rol de SUPER_ADMIN en la tabla de roles
-- Primero limpiamos cualquier otro rol que pudiera tener de prueba
DELETE FROM public.profile_roles 
WHERE profile_id IN (SELECT id FROM auth.users WHERE email = 'helmerferras@gmail.com');

-- Asignar el rol definitivo
INSERT INTO public.profile_roles (profile_id, role)
SELECT id, 'SUPER_ADMIN' 
FROM auth.users 
WHERE email = 'helmerferras@gmail.com'
ON CONFLICT DO NOTHING;

-- 5. Limpiar tablas auxiliares que podrían no haber cascado
TRUNCATE public.system_settings CASCADE; -- Ocuparemos reponer las llaves de API después
TRUNCATE public.payment_transactions CASCADE;
TRUNCATE public.subscriptions CASCADE;

-- Reactivar triggers
SET session_replication_role = 'origin';

COMMIT;

-- INSTRUCCIONES POST-LIMPIEZA:
-- 1. Acceder al dashboard de Supabase y ejecutar este script en el SQL Editor.
-- 2. Volver a configurar las llaves de API (OpenAI/Gemini/MercadoPago) en System Settings.
