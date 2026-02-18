-- 20260215000120_fix_delete_account_audit_timing.sql

-- Forced update of the delete_own_account function to handle FK constraints on audit_logs.
-- This ensures user deletion doesn't fail due to NEW audit logs created by triggers during dependency cleanup.

CREATE OR REPLACE FUNCTION delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tenant_id uuid;
    v_count integer;
BEGIN
    -- 1. Obtener tenant_id del usuario actual antes de borrarlo
    SELECT tenant_id INTO v_tenant_id FROM public.profiles WHERE id = auth.uid();

    -- 1.5. Eliminar dependencias (Suscripciones y Transacciones)
    -- Estos deletes disparan triggers que crean audit_logs con changed_by = auth.uid()
    DELETE FROM public.payment_transactions WHERE user_id = auth.uid();
    DELETE FROM public.subscriptions WHERE user_id = auth.uid();
    
    -- 2. Eliminar el perfil del usuario 
    -- Este delete dispara otro trigger que crea un audit_log
    DELETE FROM public.profiles WHERE id = auth.uid();

    -- 2.5. Eliminar ABSOLUTAMENTE TODOS los audit_logs creados por este usuario
    -- Esto debe hacerse JUSTO ANTES de eliminar el usuario auth, para borrar los logs creados arriba
    DELETE FROM public.audit_logs WHERE changed_by = auth.uid();

    -- 3. Eliminar el usuario de Auth (Esto libera el email)
    DELETE FROM auth.users WHERE id = auth.uid();

    -- 4. Limpieza de Tenant Huérfano (Opcional pero recomendado para onboarding cancelado)
    IF v_tenant_id IS NOT NULL THEN
        SELECT count(*) INTO v_count FROM public.profiles WHERE tenant_id = v_tenant_id;
        -- Si no quedan usuarios en ese tenant (probablemente era el único creando la escuela)
        IF v_count = 0 THEN
            DELETE FROM public.tenants WHERE id = v_tenant_id;
        END IF;
    END IF;
END;
$$;
