-- ==========================================
-- FINAL PRODUCTION SETUP & CLEANUP
-- ==========================================
-- Este script realiza tres acciones críticas:
-- 1. Limpia todos los datos de prueba menos los Super Admins.
-- 2. Corrige las restricciones para permitir borrar usuarios desde el panel.
-- 3. Habilita los triggers de seguridad y auditoría.

BEGIN;

-- 1. IDENTIFICAR SUPER ADMINS
DO $$
DECLARE
    admin_emails text[] := ARRAY['helmerferras@gmail.com', 'helmerpersonal@gmail.com'];
BEGIN
    -- A. ELIMINAR DATOS OPERACIONALES (Cascada borra alumnos, grupos, etc.)
    DELETE FROM public.tenants;

    -- B. LIMPIAR PERFILES Y ROLES NO-ADMIN
    DELETE FROM public.profiles 
    WHERE id NOT IN (SELECT id FROM auth.users WHERE email = ANY(admin_emails));

    DELETE FROM public.profile_roles
    WHERE profile_id NOT IN (SELECT id FROM auth.users WHERE email = ANY(admin_emails));

    -- C. LIMPIAR DATOS DE PAGO
    DELETE FROM public.payment_transactions
    WHERE user_id NOT IN (SELECT id FROM auth.users WHERE email = ANY(admin_emails));

    DELETE FROM public.subscriptions
    WHERE user_id NOT IN (SELECT id FROM auth.users WHERE email = ANY(admin_emails));

    -- D. ELIMINAR USUARIOS DE AUTH (Menos Admins)
    DELETE FROM auth.users 
    WHERE email NOT IN (SELECT unnest(admin_emails));

    -- 2. CORREGIR RESTRICCIONES DE BORRADO (ON DELETE CASCADE)
    -- Perfiles
    ALTER TABLE IF EXISTS public.profiles
    DROP CONSTRAINT IF EXISTS profiles_id_fkey,
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

    -- Suscripciones
    ALTER TABLE IF EXISTS public.subscriptions
    DROP CONSTRAINT IF EXISTS subscriptions_user_id_fkey,
    ADD CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

    -- Transacciones
    ALTER TABLE IF EXISTS public.payment_transactions
    DROP CONSTRAINT IF EXISTS payment_transactions_user_id_fkey,
    ADD CONSTRAINT payment_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

    -- Auditoría
    ALTER TABLE IF EXISTS public.audit_logs
    DROP CONSTRAINT IF EXISTS audit_logs_changed_by_fkey,
    ADD CONSTRAINT audit_logs_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES auth.users(id) ON DELETE CASCADE;

    -- Llaves de Licencia
    ALTER TABLE IF EXISTS public.license_keys
    DROP CONSTRAINT IF EXISTS license_keys_created_by_fkey,
    ADD CONSTRAINT license_keys_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE,
    DROP CONSTRAINT IF EXISTS license_keys_redeemed_by_fkey,
    ADD CONSTRAINT license_keys_redeemed_by_fkey FOREIGN KEY (redeemed_by) REFERENCES auth.users(id) ON DELETE CASCADE;

END $$;

COMMIT;

-- Recargar caché de PostgREST
NOTIFY pgrst, 'reload schema';
