-- Migration: Galactic Separation (Independent Teacher Role)
-- Description: Introduces INDEPENDENT_TEACHER role and updates triggers to enforce strict separation.

-- 1. Drop check constraint on profiles.role to allow new roles
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('ADMIN', 'TEACHER', 'TUTOR', 'STUDENT', 'INDEPENDENT_TEACHER', 'DIRECTOR', 'ACADEMIC_COORD', 'TECH_COORD', 'SCHOOL_CONTROL', 'PREFECT', 'SUPPORT', 'SUPER_ADMIN'));

-- 2. Drop check constraint on profile_tenants.role if it exists (usually text, but check)
-- (It was created as text NOT NULL, so no check constraint by default in my previous view, but good to be safe)

-- 3. Update handle_new_user trigger to assign INDEPENDENT_TEACHER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_tenant_id uuid;
  meta jsonb;
  tenant_name text;
  target_role text;
  is_independent boolean;
BEGIN
  -- Get metadata
  meta := new.raw_user_meta_data;
  
  -- Determine Mode
  is_independent := (meta->>'mode' = 'INDEPENDENT');

  -- Determine Tenant Name
  tenant_name := meta->>'organizationName';
  
  IF tenant_name IS NULL OR trim(tenant_name) = '' THEN
    tenant_name := trim(
      coalesce(meta->>'firstName', '') || ' ' || 
      coalesce(meta->>'lastNamePaternal', '') || ' ' || 
      coalesce(meta->>'lastNameMaternal', '')
    );
  END IF;

  -- Set Role based on Mode
  -- If Independent -> INDEPENDENT_TEACHER (The "Star" of their system)
  -- If School -> DIRECTOR (The "Star" of the school system, or whatever RegisterPage sent)
  -- Actually, RegisterPage sends 'DIRECTOR' for School mode creator.
  -- But for Independent, we want INDEPENDENT_TEACHER.
  
  IF is_independent THEN
    target_role := 'INDEPENDENT_TEACHER';
  ELSE
    target_role := 'DIRECTOR'; -- Default for new School creator
  END IF;

  -- Create the Tenant
  INSERT INTO public.tenants (name, type)
  VALUES (
    tenant_name,
    meta->>'mode'
  )
  RETURNING id INTO new_tenant_id;

  -- Create Global Profile
  INSERT INTO public.profiles (
    id,
    tenant_id,
    first_name,
    last_name_paternal,
    last_name_maternal,
    role
  )
  VALUES (
    new.id,
    new_tenant_id,
    meta->>'firstName',
    meta->>'lastNamePaternal',
    meta->>'lastNameMaternal',
    target_role
  );
  
  -- Create Profile Tenant Link
  INSERT INTO public.profile_tenants (
    profile_id, 
    tenant_id, 
    role, 
    is_default,
    first_name,
    last_name_paternal,
    last_name_maternal
  )
  VALUES (
    new.id, 
    new_tenant_id, 
    target_role, 
    true,
    meta->>'firstName',
    meta->>'lastNamePaternal',
    meta->>'lastNameMaternal'
  );

  RETURN new;
END;
$$;

-- 4. Update create_workspace RPC to support INDEPENDENT_TEACHER
CREATE OR REPLACE FUNCTION public.create_workspace(workspace_name text, workspace_type text, workspace_role text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    new_tenant_id uuid;
    current_profile record;
    final_role text;
BEGIN
    SELECT * INTO current_profile FROM public.profiles WHERE id = auth.uid();

    -- Enforce INDEPENDENT_TEACHER role if type is INDEPENDENT
    IF workspace_type = 'INDEPENDENT' THEN
        final_role := 'INDEPENDENT_TEACHER';
    ELSE
        final_role := workspace_role;
    END IF;

    INSERT INTO public.tenants (name, type)
    VALUES (workspace_name, workspace_type)
    RETURNING id INTO new_tenant_id;

    INSERT INTO public.profile_tenants (
        profile_id, 
        tenant_id, 
        role, 
        is_default,
        first_name,
        last_name_paternal,
        last_name_maternal,
        avatar_url
    )
    VALUES (
        auth.uid(), 
        new_tenant_id, 
        final_role, 
        false,
        current_profile.first_name,
        current_profile.last_name_paternal,
        current_profile.last_name_maternal,
        current_profile.avatar_url
    );

    UPDATE public.profiles 
    SET tenant_id = new_tenant_id, role = final_role
    WHERE id = auth.uid();

    RETURN new_tenant_id;
END;
$$;

-- 5. Migrate existing "Independent" teachers to new role
-- Update profiles and profile_tenants where tenant type is INDEPENDENT and role is TEACHER
UPDATE public.profile_tenants pt
SET role = 'INDEPENDENT_TEACHER'
FROM public.tenants t
WHERE pt.tenant_id = t.id
  AND t.type = 'INDEPENDENT'
  AND pt.role = 'TEACHER';

UPDATE public.profiles p
SET role = 'INDEPENDENT_TEACHER'
FROM public.tenants t
WHERE p.tenant_id = t.id
  AND t.type = 'INDEPENDENT'
  AND p.role = 'TEACHER';
