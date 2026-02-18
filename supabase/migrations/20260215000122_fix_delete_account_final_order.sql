-- 20260215000122_fix_delete_account_final_order.sql

-- Forced update of the delete_own_account function to fix the order of operations.
-- The Tenant Cleanup must happen BEFORE deleting the auth.user, because deleting the tenant
-- triggers audit logs that reference the user. If the user is already gone, the audit log insert fails.

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

    -- 2. Eliminar dependencias del USUARIO (Suscripciones y Transacciones)
    DELETE FROM public.payment_transactions WHERE user_id = auth.uid();
    DELETE FROM public.subscriptions WHERE user_id = auth.uid();
    
    -- 3. Eliminar el perfil del usuario 
    DELETE FROM public.profiles WHERE id = auth.uid();

    -- 4. Limpieza de Tenant Huérfano (Cascada Manual)
    -- Hacemos esto ANTES de borrar el usuario de auth, para que los triggers de audit_logs funcionen
    IF v_tenant_id IS NOT NULL THEN
        SELECT count(*) INTO v_count FROM public.profiles WHERE tenant_id = v_tenant_id;
        
        -- Si no quedan usuarios en ese tenant (probablemente era el único creando la escuela)
        IF v_count = 0 THEN
            -- Eliminar datos dependientes del tenant en orden (hijos -> padres)
            DELETE FROM public.schedules WHERE tenant_id = v_tenant_id;
            DELETE FROM public.schedule_settings WHERE tenant_id = v_tenant_id;
            DELETE FROM public.students WHERE tenant_id = v_tenant_id;
            DELETE FROM public.groups WHERE tenant_id = v_tenant_id;
            DELETE FROM public.academic_years WHERE tenant_id = v_tenant_id;
            
            -- Finalmente, eliminar el Tenant
            DELETE FROM public.tenants WHERE id = v_tenant_id;
        END IF;
    END IF;

    -- 5. Eliminar ABSOLUTAMENTE TODOS los audit_logs creados por este usuario
    -- Esto incluye los logs generados por los deletes de arriba (perfil, tenant, etc)
    DELETE FROM public.audit_logs WHERE changed_by = auth.uid();

    -- 6. Finalmente, eliminar el usuario de Auth (Esto libera el email)
    DELETE FROM auth.users WHERE id = auth.uid();

END;
$$;
