-- SCRIPT: SINCRONIZACIÓN ATÓMICA TOTAL V2 (Resilient Version)
-- Arregla el conflicto de duplicados causado por triggers automáticos.

DO $$
DECLARE
    v_admin_email TEXT := 'helmerpersonal@gmail.com';
    v_user_id UUID := '7bf6ebd0-fbf0-40f5-870a-ff9725ba80da';
    v_instance_id UUID;
BEGIN
    -- 1. Obtener el ID real de la instancia
    SELECT id INTO v_instance_id FROM auth.instances LIMIT 1;
    IF v_instance_id IS NULL THEN v_instance_id := '00000000-0000-0000-0000-000000000000'; END IF;

    -- 2. LIMPIEZA PROFUNDA
    -- Borramos en orden de dependencias para no dejar basura
    DELETE FROM public.profile_roles WHERE profile_id = v_user_id;
    DELETE FROM public.subscriptions WHERE user_id = v_user_id;
    DELETE FROM public.profile_subjects WHERE profile_id = v_user_id;
    DELETE FROM public.profiles WHERE id = v_user_id;
    DELETE FROM auth.identities WHERE user_id = v_user_id;
    DELETE FROM auth.users WHERE id = v_user_id;

    -- 3. INSERTAR EN AUTH.USERS
    -- Nota: Quitamos is_super_admin por si no existe en esta versión de Supabase
    INSERT INTO auth.users (
        id, instance_id, email, encrypted_password, 
        email_confirmed_at, aud, role, 
        raw_app_meta_data, raw_user_meta_data, 
        is_sso_user, created_at, updated_at,
        is_anonymous
    ) VALUES (
        v_user_id, v_instance_id, v_admin_email, crypt('nemia2026', gen_salt('bf', 10)),
        NOW(), 'authenticated', 'authenticated',
        '{"provider": "email", "providers": ["email"]}', '{"full_name": "Helmer Admin"}',
        false, NOW(), NOW(),
        false
    );

    -- 4. INSERTAR IDENTIDAD
    INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) VALUES (
        v_user_id, v_user_id, 
        jsonb_build_object('sub', v_user_id, 'email', v_admin_email), 
        'email', v_admin_email, NOW(), NOW(), NOW()
    ) ON CONFLICT (id) DO NOTHING;

    -- 5. CREAR/ACTUALIZAR PERFIL PÚBLICO
    -- Usamos ON CONFLICT porque el trigger on_auth_user_created puede haberlo creado ya
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (v_user_id, v_admin_email, 'Helmer Admin', 'SUPER_ADMIN')
    ON CONFLICT (id) DO UPDATE 
    SET email = EXCLUDED.email, 
        full_name = EXCLUDED.full_name, 
        role = EXCLUDED.role;

    -- 6. ASIGNAR ROL DE SISTEMA
    INSERT INTO public.profile_roles (profile_id, role)
    VALUES (v_user_id, 'SUPER_ADMIN')
    ON CONFLICT DO NOTHING;

    -- 7. LICENCIA ETERNA
    INSERT INTO public.subscriptions (user_id, status, plan_type, current_period_end)
    VALUES (v_user_id, 'active', 'annual', NOW() + INTERVAL '100 years')
    ON CONFLICT (user_id) DO UPDATE 
    SET status = 'active', 
        plan_type = 'annual', 
        current_period_end = NOW() + INTERVAL '100 years';

    RAISE NOTICE 'Sincronización Atómica Exitosa para %', v_user_id;
END $$;
