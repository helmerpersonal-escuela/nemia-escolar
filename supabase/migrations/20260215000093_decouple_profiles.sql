-- Migration: Decouple Profiles
-- Description: Adds profile fields to profile_tenants so each workspace has its own identity.

-- 1. Add columns to profile_tenants
ALTER TABLE public.profile_tenants
ADD COLUMN IF NOT EXISTS first_name text,
ADD COLUMN IF NOT EXISTS last_name_paternal text,
ADD COLUMN IF NOT EXISTS last_name_maternal text,
ADD COLUMN IF NOT EXISTS avatar_url text;

-- 2. Populate new columns for existing records (Snapshot from global profile)
UPDATE public.profile_tenants pt
SET 
  first_name = p.first_name,
  last_name_paternal = p.last_name_paternal,
  last_name_maternal = p.last_name_maternal,
  avatar_url = p.avatar_url
FROM public.profiles p
WHERE pt.profile_id = p.id
  AND pt.first_name IS NULL -- Only update if not already set
  AND p.tenant_id IS NOT NULL; -- ONLY update if we have a valid source tenant 

-- 3. Update the handle_new_user trigger to populate these fields on creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_tenant_id uuid;
  meta jsonb;
  tenant_name text;
BEGIN
  -- Get metadata from the auth.users payload
  meta := new.raw_user_meta_data;
  
  -- Determine Tenant Name
  tenant_name := meta->>'organizationName';
  
  IF tenant_name IS NULL OR trim(tenant_name) = '' THEN
    tenant_name := trim(
      coalesce(meta->>'firstName', '') || ' ' || 
      coalesce(meta->>'lastNamePaternal', '') || ' ' || 
      coalesce(meta->>'lastNameMaternal', '')
    );
  END IF;

  -- Create the Tenant
  INSERT INTO public.tenants (name, type)
  VALUES (
    tenant_name,
    meta->>'mode'
  )
  RETURNING id INTO new_tenant_id;

  -- Create the Global Profile (still needed for auth/linking)
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
    'ADMIN' -- Creator is Admin of their first workspace
  );

  -- Create the Profile Tenant Link (WITH SPECIFIC IDENTITY)
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
    'ADMIN', -- Creator role
    true,
    meta->>'firstName',
    meta->>'lastNamePaternal',
    meta->>'lastNameMaternal'
  );

  RETURN new;
END;
$$;

-- 4. Update create_workspace RPC to populate fields
CREATE OR REPLACE FUNCTION public.create_workspace(workspace_name text, workspace_type text, workspace_role text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    new_tenant_id uuid;
    current_profile record;
BEGIN
    -- Get current global profile data to use as default for new workspace
    SELECT * INTO current_profile FROM public.profiles WHERE id = auth.uid();

    -- 1. Create the tenant
    INSERT INTO public.tenants (name, type)
    VALUES (workspace_name, workspace_type)
    RETURNING id INTO new_tenant_id;

    -- 2. Link the creator to the tenant with copied profile data
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
        workspace_role, 
        false,
        current_profile.first_name,
        current_profile.last_name_paternal,
        current_profile.last_name_maternal,
        current_profile.avatar_url
    );

    -- 3. Set as active workspace
    UPDATE public.profiles SET tenant_id = new_tenant_id WHERE id = auth.uid();

    RETURN new_tenant_id;
END;
$$;

-- 5. Update update_profile_for_workspace function (New RPC)
-- This allows updating the profile SPECIFIC to the current workspace
CREATE OR REPLACE FUNCTION public.update_profile_for_workspace(
    p_first_name text,
    p_last_name_paternal text,
    p_last_name_maternal text,
    p_avatar_url text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    current_tenant_id uuid;
BEGIN
    -- Get current active tenant from profiles table
    SELECT tenant_id INTO current_tenant_id FROM public.profiles WHERE id = auth.uid();

    IF current_tenant_id IS NULL THEN
        RAISE EXCEPTION 'No active workspace found';
    END IF;

    -- Update the profile_tenants record
    UPDATE public.profile_tenants
    SET
        first_name = p_first_name,
        last_name_paternal = p_last_name_paternal,
        last_name_maternal = p_last_name_maternal,
        avatar_url = p_avatar_url
    WHERE
        profile_id = auth.uid() AND
        tenant_id = current_tenant_id;
        
    -- Optionally keep global profile in sync with the "last used" one, or decouple completely?
    -- For now, let's update global profile too just as a fallback "latest known identity"
    UPDATE public.profiles
    SET
        first_name = p_first_name,
        last_name_paternal = p_last_name_paternal,
        last_name_maternal = p_last_name_maternal,
        avatar_url = p_avatar_url
    WHERE id = auth.uid();
END;
$$;
