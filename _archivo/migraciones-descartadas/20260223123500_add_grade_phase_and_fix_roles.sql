-- ==========================================
-- ADD GRADE & PHASE TO TENANTS + FIX TRIGGER
-- ==========================================

BEGIN;

-- 1. Add columns to tenants
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS grade integer,
ADD COLUMN IF NOT EXISTS phase integer;

-- 2. Consolidated TRIGGER handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_tenant_id uuid;
  meta jsonb;
  tenant_name text;
  inv_token uuid;
  inv_record record;
  target_role text;
  is_independent boolean;
BEGIN
  meta := new.raw_user_meta_data;
  inv_token := (meta->>'invitationToken')::uuid;
  is_independent := (meta->>'mode' = 'INDEPENDENT');

  -- 1. CHECK IF JOINING VIA INVITATION
  IF inv_token IS NOT NULL THEN
    SELECT * INTO inv_record FROM staff_invitations 
    WHERE token = inv_token AND status = 'PENDING' AND expires_at > now();

    IF FOUND THEN
       new_tenant_id := inv_record.tenant_id;
       target_role := inv_record.role;
       
       -- Mark invitation as accepted
       UPDATE staff_invitations SET status = 'ACCEPTED' WHERE id = inv_record.id;
    END IF;
  END IF;

  -- 2. IF NOT JOINING, CREATE NEW TENANT
  IF new_tenant_id IS NULL THEN
    tenant_name := meta->>'organizationName';
    
    IF tenant_name IS NULL OR trim(tenant_name) = '' THEN
      tenant_name := trim(
        coalesce(meta->>'firstName', '') || ' ' || 
        coalesce(meta->>'lastNamePaternal', '') || ' ' || 
        coalesce(meta->>'lastNameMaternal', '')
      );
    END IF;

    IF is_independent THEN
      target_role := 'INDEPENDENT_TEACHER';
    ELSE
      target_role := 'DIRECTOR';
    END IF;

    INSERT INTO public.tenants (name, type)
    VALUES (tenant_name, meta->>'mode')
    RETURNING id INTO new_tenant_id;
  END IF;

  -- 3. CREATE PROFILE
  INSERT INTO public.profiles (
    id,
    tenant_id,
    first_name,
    last_name_paternal,
    last_name_maternal,
    role,
    email
  )
  VALUES (
    new.id,
    new_tenant_id,
    meta->>'firstName',
    meta->>'lastNamePaternal',
    meta->>'lastNameMaternal',
    target_role,
    new.email
  );

  -- 4. LINK TO profile_tenants (Multi-workspace support)
  INSERT INTO public.profile_tenants (profile_id, tenant_id, role, is_default)
  VALUES (new.id, new_tenant_id, target_role, true)
  ON CONFLICT DO NOTHING;

  RETURN new;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
