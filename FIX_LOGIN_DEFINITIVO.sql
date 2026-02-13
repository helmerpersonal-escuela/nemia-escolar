-- ======================================================
-- SCRIPT DE REPARACIÓN TOTAL DE LOGIN (NEMIA)
-- ======================================================
-- Este script hace 3 cosas:
-- 1. Arregla el 'instance_id' para que coincida con tu proyecto actual.
-- 2. Asegura que el usuario 'test@nemia.com' exista con contraseña 'nemia123'.
-- 3. Vincula el perfil correctamente para evitar errores post-login.

DO $$
DECLARE
    v_proper_instance_id uuid;
    v_target_email text := 'test@nemia.com';
    v_password text := 'nemia123';
    v_enc_pass text;
    v_user_id uuid;
    v_tenant_id uuid := '77777777-7777-7777-7777-777777777777'; -- ID del Tenant Demo
BEGIN
    -- 1. OBTENER EL INSTANCE_ID REAL DE TU PROYECTO
    -- Lo buscamos de cualquier usuario existente (incluso el tuyo con el que entras al dashboard)
    SELECT instance_id INTO v_proper_instance_id 
    FROM auth.users 
    WHERE instance_id IS NOT NULL 
    LIMIT 1;

    IF v_proper_instance_id IS NULL THEN
        RAISE NOTICE 'No se encontró instance_id. Usando fallback (puede fallar si es proyecto alojado).';
        v_proper_instance_id := '00000000-0000-0000-0000-000000000000';
    END IF;

    RAISE NOTICE 'Reparando con Instance ID: %', v_proper_instance_id;

    -- 2. GENERAR HASH DE CONTRASEÑA (nemia123)
    v_enc_pass := crypt(v_password, gen_salt('bf'));

    -- 3. CREAR O ACTUALIZAR EL USUARIO 'test@nemia.com'
    -- Buscamos si ya existe
    SELECT id INTO v_user_id FROM auth.users WHERE email = v_target_email;

    IF v_user_id IS NOT NULL THEN
        -- Si existe, actualizamos contraseña e instance_id
        UPDATE auth.users 
        SET encrypted_password = v_enc_pass,
            instance_id = v_proper_instance_id,
            email_confirmed_at = now(),
            updated_at = now()
        WHERE id = v_user_id;
        RAISE NOTICE 'Usuario actualizado: %', v_target_email;
    ELSE
        -- Si no existe, lo creamos
        v_user_id := gen_random_uuid();
        INSERT INTO auth.users (
            id, instance_id, aud, role, email, encrypted_password, 
            email_confirmed_at, created_at, updated_at, 
            raw_app_meta_data, raw_user_meta_data
        ) VALUES (
            v_user_id, v_proper_instance_id, 'authenticated', 'authenticated', 
            v_target_email, v_enc_pass, now(), now(), now(),
            '{"provider":"email","providers":["email"]}', '{"firstName":"Profesor","lastNamePaternal":"Test"}'
        );
        RAISE NOTICE 'Usuario creado: %', v_target_email;
    END IF;

    -- 4. ASEGURAR QUE TODOS LOS USUARIOS @demo.com o @test.com TENGAN EL INSTANCE_ID CORRECTO
    UPDATE auth.users 
    SET instance_id = v_proper_instance_id
    WHERE (email LIKE '%@demo.com' OR email LIKE '%@test.com' OR email LIKE '%@nemia.com')
    AND instance_id IS DISTINCT FROM v_proper_instance_id;

    -- 5. VINCULAR PERFIL (PUBLIC.PROFILES)
    INSERT INTO public.profiles (id, tenant_id, role, first_name, full_name, profile_setup_completed)
    VALUES (v_user_id, v_tenant_id, 'INDEPENDENT_TEACHER', 'Profesor', 'Profesor Test NEMIA', true)
    ON CONFLICT (id) DO UPDATE SET 
        tenant_id = v_tenant_id,
        role = 'INDEPENDENT_TEACHER',
        profile_setup_completed = true;

    -- 6. ASIGNAR ROL
    INSERT INTO public.profile_roles (profile_id, role)
    VALUES (v_user_id, 'INDEPENDENT_TEACHER')
    ON CONFLICT (profile_id, role) DO NOTHING;

    RAISE NOTICE 'Sincronización terminada. Intenta entrar con: % / %', v_target_email, v_password;
END $$;
