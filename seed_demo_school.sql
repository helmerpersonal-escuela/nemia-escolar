-- ==========================================
-- SCRIPT DE DATOS DE DEMOSTRACIÓN (CORREGIDO)
-- ==========================================
-- Este script crea la "Escuela Demo" y sus usuarios.
-- Ejecutar en SQL Editor de Supabase.

BEGIN;

-- 1. Asegurar que pgcrypto está habilitado
-- 1. Asegurar que pgcrypto está habilitado
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1.5. FORZAR ACTUALIZACIÓN DEL TRIGGER (Parche de seguridad)
-- Esto asegura que la lógica de asignación de tenantId funcione incluso si la migración falló.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
declare
  new_tenant_id uuid;
  meta jsonb;
  tenant_name text;
  inv_token uuid;
  target_tenant_id uuid;
  inv_record record;
  assigned_role text;
  first_name text;
  last_name_paternal text;
  last_name_maternal text;
begin
  meta := new.raw_user_meta_data;
  
  first_name := coalesce(meta->>'firstName', '');
  last_name_paternal := coalesce(meta->>'lastNamePaternal', '');
  last_name_maternal := coalesce(meta->>'lastNameMaternal', '');
  
  -- 1. PRIORITY: Explicit tenantId
  target_tenant_id := (meta->>'tenantId')::uuid;
  
  if target_tenant_id is not null then
    perform 1 from public.tenants where id = target_tenant_id;
    if found then
        new_tenant_id := target_tenant_id;
        assigned_role := coalesce(meta->>'role', 'TEACHER');
    end if;
  end if;

  -- 2. PRIORITY: Invitation
  if new_tenant_id is null then
      inv_token := (meta->>'invitationToken')::uuid;
      if inv_token is not null then
        select * into inv_record from staff_invitations 
        where token = inv_token and status = 'PENDING' and expires_at > now();
        if found then
           new_tenant_id := inv_record.tenant_id;
           assigned_role := inv_record.role;
           update staff_invitations set status = 'ACCEPTED' where id = inv_record.id;
        end if;
      end if;
  end if;

  -- 3. FALLBACK: New School
  if new_tenant_id is null then
    tenant_name := meta->>'organizationName';
    if tenant_name is null or trim(tenant_name) = '' then
      tenant_name := trim(first_name || ' ' || last_name_paternal || ' ' || last_name_maternal);
      if trim(tenant_name) = '' then tenant_name := 'Nueva Escuela'; end if;
    end if;

    insert into public.tenants (name, type)
    values (tenant_name, coalesce(meta->>'mode', 'SCHOOL'))
    returning id into new_tenant_id;
    
    assigned_role := 'ADMIN';
  end if;

  insert into public.profiles (id, tenant_id, first_name, last_name_paternal, last_name_maternal, role)
  values (new.id, new_tenant_id, first_name, last_name_paternal, last_name_maternal, assigned_role);
  
  insert into public.profile_roles (profile_id, role)
  values (new.id, assigned_role)
  on conflict do nothing;

  return new;
end;
$$;

-- 2. Ejecutar lógica de creación
DO $$
DECLARE
    -- ID fijo para la escuela demo (UUID válido)
    v_tenant_id uuid := 'd0000000-0000-4000-a000-000000000000';
    v_password text := 'Password123!';
    v_enc_pass text;
BEGIN
    -- Generar hash de contraseña
    v_enc_pass := crypt(v_password, gen_salt('bf'));

    -- 3. Crear el Tenant de Demostración
    INSERT INTO public.tenants (id, name, type, onboarding_completed, created_at)
    VALUES (v_tenant_id, 'Instituto Nuevo Horizonte (Demo)', 'SCHOOL', true, now())
    ON CONFLICT (id) DO UPDATE 
    SET name = 'Instituto Nuevo Horizonte (Demo)', onboarding_completed = true;

    -- 4. Crear Usuarios (Verificando existencia por email)
    
    -- DIRECTOR
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'director@demo.com') THEN
        INSERT INTO auth.users (
            instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, 
            raw_user_meta_data, raw_app_meta_data, created_at, updated_at
        ) VALUES (
            '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 
            'director@demo.com', v_enc_pass, now(), 
            jsonb_build_object('firstName', 'Roberto', 'lastNamePaternal', 'Sánchez', 'role', 'DIRECTOR', 'tenantId', v_tenant_id),
            '{"provider": "email", "providers": ["email"]}', now(), now()
        );
    END IF;

    -- COORDINADOR ACADÉMICO
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'academico@demo.com') THEN
        INSERT INTO auth.users (
            instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, 
            raw_user_meta_data, raw_app_meta_data, created_at, updated_at
        ) VALUES (
            '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 
            'academico@demo.com', v_enc_pass, now(), 
            jsonb_build_object('firstName', 'Laura', 'lastNamePaternal', 'Méndez', 'role', 'ACADEMIC_COORD', 'tenantId', v_tenant_id),
            '{"provider": "email", "providers": ["email"]}', now(), now()
        );
    END IF;

    -- COORDINADOR TECNOLÓGICO
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'tecnologia@demo.com') THEN
        INSERT INTO auth.users (
            instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, 
            raw_user_meta_data, raw_app_meta_data, created_at, updated_at
        ) VALUES (
            '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 
            'tecnologia@demo.com', v_enc_pass, now(), 
            jsonb_build_object('firstName', 'Carlos', 'lastNamePaternal', 'Ruiz', 'role', 'TECH_COORD', 'tenantId', v_tenant_id),
            '{"provider": "email", "providers": ["email"]}', now(), now()
        );
    END IF;

    -- CONTROL ESCOLAR
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'control@demo.com') THEN
        INSERT INTO auth.users (
            instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, 
            raw_user_meta_data, raw_app_meta_data, created_at, updated_at
        ) VALUES (
            '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 
            'control@demo.com', v_enc_pass, now(), 
            jsonb_build_object('firstName', 'Ana', 'lastNamePaternal', 'López', 'role', 'SCHOOL_CONTROL', 'tenantId', v_tenant_id),
            '{"provider": "email", "providers": ["email"]}', now(), now()
        );
    END IF;

    -- DOCENTE
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'docente@demo.com') THEN
        INSERT INTO auth.users (
            instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, 
            raw_user_meta_data, raw_app_meta_data, created_at, updated_at
        ) VALUES (
            '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 
            'docente@demo.com', v_enc_pass, now(), 
            jsonb_build_object('firstName', 'Mario', 'lastNamePaternal', 'Gómez', 'role', 'TEACHER', 'tenantId', v_tenant_id),
            '{"provider": "email", "providers": ["email"]}', now(), now()
        );
    END IF;

    -- PREFECTURA
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'prefectura@demo.com') THEN
        INSERT INTO auth.users (
            instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, 
            raw_user_meta_data, raw_app_meta_data, created_at, updated_at
        ) VALUES (
            '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 
            'prefectura@demo.com', v_enc_pass, now(), 
            jsonb_build_object('firstName', 'Pedro', 'lastNamePaternal', 'Ramírez', 'role', 'PREFECT', 'tenantId', v_tenant_id),
            '{"provider": "email", "providers": ["email"]}', now(), now()
        );
    END IF;

    -- APOYO EDUCATIVO
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'apoyo@demo.com') THEN
        INSERT INTO auth.users (
            instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, 
            raw_user_meta_data, raw_app_meta_data, created_at, updated_at
        ) VALUES (
            '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 
            'apoyo@demo.com', v_enc_pass, now(), 
            jsonb_build_object('firstName', 'Sofía', 'lastNamePaternal', 'Vargas', 'role', 'SUPPORT', 'tenantId', v_tenant_id),
            '{"provider": "email", "providers": ["email"]}', now(), now()
        );
    END IF;

    -- ALUMNO
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'alumno@demo.com') THEN
        INSERT INTO auth.users (
            instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, 
            raw_user_meta_data, raw_app_meta_data, created_at, updated_at
        ) VALUES (
            '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 
            'alumno@demo.com', v_enc_pass, now(), 
            jsonb_build_object('firstName', 'Luisito', 'lastNamePaternal', 'Alumno', 'role', 'STUDENT', 'tenantId', v_tenant_id),
            '{"provider": "email", "providers": ["email"]}', now(), now()
        );
    END IF;

END $$;

COMMIT;
