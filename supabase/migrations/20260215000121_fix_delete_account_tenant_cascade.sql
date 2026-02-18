-- 20260215000121_fix_delete_account_tenant_cascade.sql

-- Forced update of the delete_own_account function to handle FK constraints on tenant deletion.
-- This ensures that if the tenant is orphaned (no users left), all its data is wiped clean.

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

    -- 1.5. Eliminar dependencias del USUARIO (Suscripciones y Transacciones)
    DELETE FROM public.payment_transactions WHERE user_id = auth.uid();
    DELETE FROM public.subscriptions WHERE user_id = auth.uid();
    
    -- 2. Eliminar el perfil del usuario 
    DELETE FROM public.profiles WHERE id = auth.uid();

    -- 2.5. Eliminar ABSOLUTAMENTE TODOS los audit_logs creados por este usuario
    DELETE FROM public.audit_logs WHERE changed_by = auth.uid();

    -- 3. Eliminar el usuario de Auth (Esto libera el email)
    DELETE FROM auth.users WHERE id = auth.uid();

    -- 4. Limpieza de Tenant Huérfano (Cascada Manual)
    IF v_tenant_id IS NOT NULL THEN
        SELECT count(*) INTO v_count FROM public.profiles WHERE tenant_id = v_tenant_id;
        
        -- Si no quedan usuarios en ese tenant (probablemente era el único creando la escuela)
        IF v_count = 0 THEN
            -- Eliminar datos dependientes del tenant en orden (hijos -> padres)
            
            -- Schedules y Settings
            DELETE FROM public.schedules WHERE tenant_id = v_tenant_id;
            DELETE FROM public.schedule_settings WHERE tenant_id = v_tenant_id;
            
            -- Students y Groups (Grupos dependen de Years, Estudiantes de Grupos)
            -- Asumiendo que students tienen tenant_id
            DELETE FROM public.students WHERE tenant_id = v_tenant_id;
            
            -- Grupos dependen de academic_years
            -- DELETE FROM public.groups WHERE tenant_id = v_tenant_id; -- (Si tienen tenant_id directo)
            -- O borrar via academic_years si es cascade, pero mejor explícito
            DELETE FROM public.groups WHERE tenant_id = v_tenant_id;

            -- Academic Years (Esto solía bloquear el borrado del tenant)
            DELETE FROM public.academic_years WHERE tenant_id = v_tenant_id;

            -- Subjects (Si son por tenant)
            -- DELETE FROM public.subjects WHERE tenant_id = v_tenant_id; 

            -- Finalmente, eliminar el Tenant
            DELETE FROM public.tenants WHERE id = v_tenant_id;
        END IF;
    END IF;
END;
$$;
