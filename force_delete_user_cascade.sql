-- FUNCIÓN: BORRADO FORZADO V2 (Sin bloques DO anónimos que fallan)
-- Ejecuta esto UNA VEZ para crear la función, y luego llámala.

CREATE OR REPLACE FUNCTION public.delete_user_cascade(p_email text)
RETURNS text AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- 1. Obtener ID
    SELECT id INTO v_user_id FROM auth.users WHERE email = p_email;

    IF v_user_id IS NULL THEN
        RETURN '⚠️ Usuario no encontrado: ' || p_email;
    END IF;

    -- 2. Eliminar dependencias (Suscripciones, Pagos)
    DELETE FROM public.payment_transactions WHERE user_id = v_user_id;
    DELETE FROM public.subscriptions WHERE user_id = v_user_id;

    -- 3. Eliminar dependencias de perfil
    DELETE FROM public.profile_roles WHERE profile_id = v_user_id;
    DELETE FROM public.staff_commissions WHERE profile_id = v_user_id;
    DELETE FROM public.staff_attendance WHERE profile_id = v_user_id;
    
    -- 4. Eliminar Perfil
    DELETE FROM public.profiles WHERE id = v_user_id;

    -- 5. Eliminar identidades
    DELETE FROM auth.identities WHERE user_id = v_user_id;

    -- 6. Eliminar usuario auth
    DELETE FROM auth.users WHERE id = v_user_id;

    RETURN '✅ Usuario eliminado correctamente: ' || p_email;
EXCEPTION WHEN OTHERS THEN
    RETURN '❌ Error al eliminar: ' || SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Llama a la función directamente
SELECT public.delete_user_cascade('helmerpersonal@gmail.com');
