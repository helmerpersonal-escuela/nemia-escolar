-- SCRIPT: REPARACIÓN TOTAL DE METADATOS V2 (Fix Generated Column)
-- Elimina confirmed_at de la actualización para evitar el error 428C9.

DO $$
DECLARE
    v_user_id UUID;
    v_instance_id UUID;
BEGIN
    -- 1. Obtener IDs
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'helmerpersonal@gmail.com';
    SELECT id INTO v_instance_id FROM auth.instances LIMIT 1;

    -- 2. Asegurar ID por defecto si v_instance_id es NULL
    IF v_instance_id IS NULL THEN
        v_instance_id := '00000000-0000-0000-0000-000000000000';
    END IF;

    -- 3. Forzar Metadata y Roles
    -- Quitamos 'confirmed_at' porque es una columna generada por el sistema.
    UPDATE auth.users 
    SET 
        aud = 'authenticated',
        role = 'authenticated',
        email_confirmed_at = NOW(), -- Este es el importante para confirmar la cuenta
        last_sign_in_at = NOW(),
        raw_app_meta_data = '{"provider": "email", "providers": ["email"]}',
        raw_user_meta_data = '{"full_name": "Helmer Admin"}',
        is_sso_user = false,
        instance_id = v_instance_id,
        is_anonymous = false
    WHERE id = v_user_id;

    -- 4. Asegurar Password con Hash Bcrypt $2a$
    UPDATE auth.users 
    SET encrypted_password = crypt('nemia2026', gen_salt('bf', 10))
    WHERE id = v_user_id;

    RAISE NOTICE 'Sincronización final completada para %', v_user_id;
END $$;

-- Verificación final
SELECT id, email, aud, role, email_confirmed_at FROM auth.users WHERE email = 'helmerpersonal@gmail.com';
