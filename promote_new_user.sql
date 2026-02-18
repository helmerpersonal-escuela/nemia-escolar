-- =================================================================
-- SCRIPT: PROMOVER USUARIO REGISTRADO A MODO DIOS
-- =================================================================

DO $$
DECLARE
    v_target_email text := 'helmerpersonal@gmail.com';
    v_user_id UUID;
BEGIN
    -- 1. Buscar el usuario
    SELECT id INTO v_user_id FROM auth.users WHERE email = v_target_email;
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuario % no encontrado. Asegúrate de haberte registrado primero.', v_target_email;
    END IF;

    -- 2. Asegurar Perfil
    -- Si se registró, ya debería tener perfil, pero actualizamos el ROL
    UPDATE public.profiles 
    SET role = 'SUPER_ADMIN', first_name = 'Helmer', last_name_paternal = 'God'
    WHERE id = v_user_id;

    -- 3. Asignar Rol Explícito
    INSERT INTO public.profile_roles (profile_id, role)
    VALUES (v_user_id, 'SUPER_ADMIN')
    ON CONFLICT (profile_id, role) DO NOTHING;

    -- 4. Crear/Actualizar Suscripción
    INSERT INTO public.subscriptions (user_id, status, plan_type, current_period_end)
    VALUES (v_user_id, 'active', 'ANNUAL', NOW() + INTERVAL '100 years')
    ON CONFLICT (user_id) DO UPDATE 
    SET status = 'active', 
        plan_type = 'ANNUAL',
        current_period_end = NOW() + INTERVAL '100 years';
        
    RAISE NOTICE 'Usuario % promovido a SUPER_ADMIN exitosamente.', v_target_email;
END $$;
