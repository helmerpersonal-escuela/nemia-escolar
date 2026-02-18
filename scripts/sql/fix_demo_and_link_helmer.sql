-- SCRIPT DE REPARACIÓN Y VINCULACIÓN FINAL
-- Ejecutar en SQL Editor de Supabase.

DO $$
DECLARE
    v_tenant_id uuid := 'd0000000-0000-4000-A000-000000000000';
    v_user_email text := 'helmerpersonal@outlook.com';
BEGIN

    -- 1. SOLUCIONAR ERROR 406: Crear Ciclo Escolar para la Demo
    -- Si no existe un ciclo activo, el dashboard explota.
    INSERT INTO public.academic_years (tenant_id, name, start_date, end_date, is_active)
    VALUES (
        v_tenant_id, 
        'Ciclo Escolar 2025-2026', 
        '2025-08-26', 
        '2026-07-16', 
        true
    )
    ON CONFLICT DO NOTHING;

    -- 2. VINCULAR TU CUENTA PERSONAL A LA DEMO
    -- Actualizar metadata de Auth
    UPDATE auth.users
    SET 
        raw_user_meta_data = jsonb_build_object(
            'firstName', 'Helmer', 
            'lastNamePaternal', 'Director', 
            'role', 'DIRECTOR',
            'tenantId', v_tenant_id,
            'organizationName', 'Instituto Nuevo Horizonte (Demo)'
        )
    WHERE email = v_user_email;

    -- 3. Actualizar/Crear Perfil Público
    -- Primero intentamos update
    UPDATE public.profiles
    SET 
        tenant_id = v_tenant_id,
        role = 'DIRECTOR',
        first_name = 'Helmer',
        last_name_paternal = 'Director'
    WHERE id = (SELECT id FROM auth.users WHERE email = v_user_email);

    -- Si no existe perfil, lo insertamos (caso raro si ya entraste al dashboard)
    INSERT INTO public.profiles (id, tenant_id, first_name, last_name_paternal, role)
    SELECT 
        id, 
        v_tenant_id,
        'Helmer', 
        'Director', 
        'DIRECTOR'
    FROM auth.users 
    WHERE email = v_user_email
    ON CONFLICT (id) DO UPDATE 
    SET tenant_id = v_tenant_id, role = 'DIRECTOR';

    -- 4. Asegurar Rol en tabla auxiliar
    INSERT INTO public.profile_roles (profile_id, role)
    SELECT id, 'DIRECTOR' FROM auth.users WHERE email = v_user_email
    ON CONFLICT DO NOTHING;

    RAISE NOTICE '¡Reparación completada! Ciclo escolar creado y usuario % vinculado.', v_user_email;

END $$;
