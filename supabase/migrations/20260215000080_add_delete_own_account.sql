-- 20260215000080_add_delete_own_account.sql

-- Función para que un usuario pueda auto-eliminarse (útil para cancelar registro incompleto)
-- Elimina primero el perfil (para evitar bloqueo por FK) y luego el usuario de Auth.
-- También intenta eliminar el Tenant si quedó huérfano (sin usuarios).

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
