-- =================================================================
-- SCRIPT: RECREACIÓN TOTAL DE USUARIO MODO DIOS
-- =================================================================

-- 1. Limpieza previa (Borrar usuario si existe)
-- Nota: Esto borrará perfil, suscripción y datos relacionados por CASCADE
DELETE FROM auth.users WHERE email = 'helmerpersonal@gmail.com';

-- 2. Insertar usuario nuevo en auth.users
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'helmerpersonal@gmail.com',
    crypt('nemia2026', gen_salt('bf')), -- Contraseña: nemia2026
    NOW(), -- Email confirmado automáticamente
    '{"provider": "email", "providers": ["email"]}',
    '{"first_name": "Helmer", "last_name": "God", "role": "SUPER_ADMIN"}',
    NOW(),
    NOW(),
    '', 
    '' 
);

-- 3. Configurar Roles y Suscripción
DO $$
DECLARE
    v_user_id UUID;
BEGIN
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'helmerpersonal@gmail.com';

    -- A. Asegurar Perfil (si el trigger no lo creó o falló)
    INSERT INTO public.profiles (id, first_name, last_name_paternal, role)
    VALUES (v_user_id, 'Helmer', 'God', 'SUPER_ADMIN')
    ON CONFLICT (id) DO UPDATE 
    SET role = 'SUPER_ADMIN', first_name = 'Helmer', last_name_paternal = 'God';

    -- B. Asignar Rol Explícito en profile_roles
    INSERT INTO public.profile_roles (profile_id, role)
    VALUES (v_user_id, 'SUPER_ADMIN')
    ON CONFLICT (profile_id, role) DO NOTHING;

    -- C. Crear Suscripción "God Mode" (Vitalicia)
    INSERT INTO public.subscriptions (user_id, status, plan_type, current_period_end)
    VALUES (v_user_id, 'active', 'ANNUAL', NOW() + INTERVAL '100 years')
    ON CONFLICT (user_id) DO UPDATE 
    SET status = 'active', 
        plan_type = 'ANNUAL',
        current_period_end = NOW() + INTERVAL '100 years';
        
    RAISE NOTICE 'Usuario Modo Dios recreado exitosamente. ID: %', v_user_id;
END $$;
