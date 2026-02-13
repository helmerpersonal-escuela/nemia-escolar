-- SCRIPT DE VINCULACIÓN MANUAL (Plan B)
-- Ejecutar en SQL Editor de Supabase DESPUÉS de crear el usuario manalmente.

-- 1. Definir ID de la Escuela Demo (Debe coincidir con seed)
DO $$
DECLARE
    v_tenant_id uuid := 'd0000000-0000-4000-a000-000000000000';
    v_email text := 'director@demo.com'; 
BEGIN

    -- 2. Actualizar Metadata del Usuario (Auth)
    UPDATE auth.users
    SET 
        raw_user_meta_data = jsonb_build_object(
            'firstName', 'Director', 
            'lastNamePaternal', 'Demo', 
            'role', 'DIRECTOR',
            'tenantId', v_tenant_id
        ),
        email_confirmed_at = COALESCE(email_confirmed_at, now()) -- Confirmar si no lo estaba
    WHERE email = v_email;

    -- 3. Crear/Vincular Perfil (Public)
    INSERT INTO public.profiles (id, tenant_id, first_name, last_name_paternal, role)
    SELECT 
        id, 
        v_tenant_id,
        'Director', 
        'Demo', 
        'DIRECTOR'
    FROM auth.users 
    WHERE email = v_email
    ON CONFLICT (id) DO UPDATE 
    SET tenant_id = v_tenant_id, role = 'DIRECTOR';

    -- 4. Asegurar Roles
    INSERT INTO public.profile_roles (profile_id, role)
    SELECT id, 'DIRECTOR' FROM auth.users WHERE email = v_email
    ON CONFLICT DO NOTHING;

    -- 5. Imprimir éxito
    RAISE NOTICE 'Usuario % vinculado exitosamente a la Escuela Demo.', v_email;

END $$;
