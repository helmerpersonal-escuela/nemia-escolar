-- SCRIPT: CREACIÓN MANUAL DE USUARIO V3 (A prueba de Triggers y Errores)
-- Este script verifica si el usuario existe y lo arregla, o lo crea desde cero.
-- Maneja conflictos con triggers automáticos.

-- SCRIPT: CREACIÓN MANUAL DE USUARIO V4 (Bypass Bloqueo + Idempotencia)

-- 0. PRIMERO: Actualizar la regla de seguridad para permitir tu correo
CREATE OR REPLACE FUNCTION public.enforce_super_admin_limit()
RETURNS TRIGGER AS $$
DECLARE
    v_user_email text;
BEGIN
    IF NEW.role = 'SUPER_ADMIN' THEN
        -- Obtener email de la tabla profiles ya que profile_roles no lo tiene
        SELECT email INTO v_user_email FROM public.profiles WHERE id = NEW.profile_id;
        
        -- Permitir AMBOS correos por seguridad
        IF v_user_email NOT IN ('helmerferras@gmail.com', 'helmerpersonal@gmail.com') THEN
            RAISE EXCEPTION 'Security Violation: Only helmerpersonal@gmail.com can be SUPER_ADMIN (Attempted: %)', v_user_email;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
DECLARE
    v_user_id UUID;
    v_email TEXT := 'helmerpersonal@gmail.com';
    v_password TEXT := 'nemia2026';
    v_encrypted_pw TEXT;
BEGIN
    -- 1. Verificar si el usuario ya existe
    SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;

    IF v_user_id IS NOT NULL THEN
        RAISE NOTICE '⚠️ El usuario ya existe (ID: %). Actualizando contraseña...', v_user_id;
        
        -- Actualizar password
        UPDATE auth.users 
        SET encrypted_password = crypt(v_password, gen_salt('bf')),
            raw_user_meta_data = '{"full_name": "Helmer God"}'
        WHERE id = v_user_id;

    ELSE
        -- Crear usuario nuevo
        v_user_id := gen_random_uuid();
        v_encrypted_pw := crypt(v_password, gen_salt('bf'));
        
        RAISE NOTICE '✨ Creando usuario nuevo (ID: %)...', v_user_id;

        INSERT INTO auth.users (
            instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, 
            raw_app_meta_data, raw_user_meta_data, created_at, updated_at
        ) VALUES (
            '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated', v_email, v_encrypted_pw, NOW(),
            '{"provider": "email", "providers": ["email"]}', '{"full_name": "Helmer God"}', NOW(), NOW()
        );
        
        -- Insertar Identidad (Si falla por duplicado, no importa)
        INSERT INTO auth.identities (
            id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
        ) VALUES (
            v_user_id, v_user_id, v_user_id, jsonb_build_object('sub', v_user_id, 'email', v_email), 'email', NOW(), NOW(), NOW()
        );
    END IF;

    -- 2. Asegurar Perfil (Idempotente)
    -- Usamos ON CONFLICT por si un trigger ya lo creó
    INSERT INTO public.profiles (id, email, first_name, last_name_paternal, role)
    VALUES (v_user_id, v_email, 'Helmer', 'God', 'SUPER_ADMIN')
    ON CONFLICT (id) DO UPDATE
    SET role = 'SUPER_ADMIN';

    -- 3. Asegurar Suscripción (Idempotente)
    -- CRÍTICO: Aquí fallaba antes por triggers automáticos. ON CONFLICT lo soluciona.
    INSERT INTO public.subscriptions (user_id, status, plan_type, current_period_end)
    VALUES (v_user_id, 'active', 'ANNUAL', NOW() + INTERVAL '100 years')
    ON CONFLICT (user_id) DO UPDATE 
    SET status = 'active', 
        plan_type = 'ANNUAL', 
        current_period_end = NOW() + INTERVAL '100 years';

    -- 4. Asegurar Rol en tabla auxiliar
    INSERT INTO public.profile_roles (profile_id, role)
    VALUES (v_user_id, 'SUPER_ADMIN')
    ON CONFLICT (profile_id, role) DO NOTHING;

    RAISE NOTICE '✅ ÉXITO TOTAL. Usuario % listo. Password: %', v_email, v_password;
END $$;
