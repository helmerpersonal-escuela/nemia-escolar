-- ======================================================
-- REPARACIÓN INTEGRAL: LOGIN + PERFIL + TRIGGER
-- ======================================================

-- 1. ASEGURAR QUE EL TRIGGER Y LA FUNCIÓN EXISTAN Y SEAN CORRECTOS
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
declare
  new_tenant_id uuid;
  assigned_role text;
begin
  -- Si es el usuario que creó el cliente manualmente, le asignamos el tenant demo y rol teacher
  if new.email = 'usuario@prueba.com' then
    new_tenant_id := '77777777-7777-7777-7777-777777777777';
    assigned_role := 'INDEPENDENT_TEACHER';
  else
    -- Lógica por defecto (puedes ajustarla)
    new_tenant_id := (new.raw_user_meta_data->>'tenantId')::uuid;
    assigned_role := coalesce(new.raw_user_meta_data->>'role', 'TEACHER');
  end if;

  -- Crear el perfil
  insert into public.profiles (id, tenant_id, role, first_name, full_name, profile_setup_completed)
  values (
    new.id, 
    coalesce(new_tenant_id, '77777777-7777-7777-7777-777777777777'), 
    assigned_role,
    coalesce(new.raw_user_meta_data->>'firstName', 'Usuario'),
    coalesce(new.raw_user_meta_data->>'firstName', 'Usuario') || ' ' || coalesce(new.raw_user_meta_data->>'lastNamePaternal', 'Prueba'),
    true
  )
  on conflict (id) do update set 
    tenant_id = excluded.tenant_id,
    role = excluded.role;
  
  -- Asignar rol
  insert into public.profile_roles (profile_id, role)
  values (new.id, assigned_role)
  on conflict do nothing;

  return new;
end;
$$;

-- Vincular el trigger si no existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'on_auth_user_created') THEN
        CREATE TRIGGER on_auth_user_created
        AFTER INSERT ON auth.users
        FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
    END IF;
END $$;

-- 2. REPARAR AL USUARIO YA CREADO (usuario@prueba.com)
DO $$
DECLARE
    v_user_id uuid;
    v_instance_id uuid;
    v_tenant_id uuid := '77777777-7777-7777-7777-777777777777';
BEGIN
    -- Obtener ID y Instance ID del usuario que sí funciona
    SELECT id, instance_id INTO v_user_id, v_instance_id 
    FROM auth.users 
    WHERE email = 'usuario@prueba.com' 
    LIMIT 1;

    IF v_user_id IS NOT NULL THEN
        RAISE NOTICE 'Reparando perfiles para usuario: % con Instance ID: %', v_user_id, v_instance_id;

        -- Crear perfil manualmente por si el trigger falló
        INSERT INTO public.profiles (id, tenant_id, role, first_name, full_name, profile_setup_completed)
        VALUES (v_user_id, v_tenant_id, 'INDEPENDENT_TEACHER', 'Usuario', 'Usuario Prueba', true)
        ON CONFLICT (id) DO UPDATE SET 
            tenant_id = v_tenant_id,
            role = 'INDEPENDENT_TEACHER',
            profile_setup_completed = true;

        INSERT INTO public.profile_roles (profile_id, role)
        VALUES (v_user_id, 'INDEPENDENT_TEACHER')
        ON CONFLICT (profile_id, role) DO NOTHING;

        -- 3. SINCRONIZAR TODOS LOS DEMÁS USUARIOS CON ESTE INSTANCE_ID
        UPDATE auth.users 
        SET instance_id = v_instance_id,
            email_confirmed_at = now()
        WHERE (email LIKE '%@demo.com' OR email LIKE '%@nemia.com' OR email LIKE '%@test.com' OR email = 'usuario@prueba.com')
        AND instance_id IS DISTINCT FROM v_instance_id;

        RAISE NOTICE 'Sincronización terminada. Todos los usuarios deberían funcionar ahora.';
    ELSE
        RAISE NOTICE 'No se encontró el usuario usuario@prueba.com. Por favor créalo en el Dashboard primero.';
    END IF;
END $$;
