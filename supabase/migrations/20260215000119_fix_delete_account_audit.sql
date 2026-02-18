-- 20260215000119_fix_delete_account_audit.sql

-- Forced update of the delete_own_account function to handle FK constraints on audit_logs.
-- This ensures user deletion doesn't fail due to existing audit logs.

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

    -- 1.5. Eliminar dependencias (Suscripciones, Transacciones y Audit Logs)
    -- Primero logs, luego transacciones, luego suscripciones
    
    -- Intenta eliminar audit_logs donde el usuario es el actor ("changed_by")
    DELETE FROM public.audit_logs WHERE changed_by = auth.uid();
    
    -- Si audit_logs tiene user_id como target, también eliminar (aunque el error dice changed_by)
    -- DELETE FROM public.audit_logs WHERE record_id = auth.uid()::text AND table_name = 'profiles'; -- Opcional si queremos limpiar rastros sobre el usuario

    DELETE FROM public.payment_transactions WHERE user_id = auth.uid();
    DELETE FROM public.subscriptions WHERE user_id = auth.uid();
    
    -- 2. Eliminar el perfil del usuario (Trigger de Auth debería manejarlo, pero por si las FK no son cascade)
    DELETE FROM public.profiles WHERE id = auth.uid();

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
