-- 1. Create staff_invitations table
CREATE TABLE IF NOT EXISTS public.staff_invitations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
    email text NOT NULL,
    role text NOT NULL,
    token uuid DEFAULT gen_random_uuid() UNIQUE,
    status text DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'EXPIRED')),
    created_by uuid REFERENCES public.profiles(id),
    created_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone DEFAULT (now() + interval '7 days')
);

-- Enable RLS for staff_invitations
ALTER TABLE public.staff_invitations ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'staff_invitations' AND policyname = 'Admins can manage invitations in their tenant'
    ) THEN
        CREATE POLICY "Admins can manage invitations in their tenant"
        ON public.staff_invitations FOR ALL
        USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));
    END IF;
END $$;

-- 2. Create RPC to get invitation info securely (Publicly accessible but via token)
CREATE OR REPLACE FUNCTION public.get_invitation_info(token_uuid uuid)
RETURNS TABLE (
    tenant_name text,
    role text,
    email text
) 
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT t.name, i.role, i.email
    FROM staff_invitations i
    JOIN tenants t ON t.id = i.tenant_id
    WHERE i.token = token_uuid AND i.status = 'PENDING' AND i.expires_at > now();
END;
$$;

-- 3. Update handle_new_user trigger to handle JOIN mode
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
  inv_record record;
  assigned_role text;
begin
  meta := new.raw_user_meta_data;
  inv_token := (meta->>'invitationToken')::uuid;

  -- CHECK IF JOINING VIA INVITATION
  if inv_token is not null then
    select * into inv_record from staff_invitations 
    where token = inv_token and status = 'PENDING' and expires_at > now();

    if found then
       new_tenant_id := inv_record.tenant_id;
       assigned_role := inv_record.role;
       
       -- Mark invitation as accepted
       update staff_invitations set status = 'ACCEPTED' where id = inv_record.id;
    else
       -- If token is invalid/expired, we might want to fail or default to new tenant. 
       -- For now, let's treat it as a new tenant request if JOIN fails but keep track.
       assigned_role := 'ADMIN'; 
    end if;
  end if;

  -- IF NOT JOINING, CREATE NEW TENANT
  if new_tenant_id is null then
    tenant_name := meta->>'organizationName';
    
    if tenant_name is null or trim(tenant_name) = '' then
      tenant_name := trim(
        coalesce(meta->>'firstName', '') || ' ' || 
        coalesce(meta->>'lastNamePaternal', '') || ' ' || 
        coalesce(meta->>'lastNameMaternal', '')
      );
    end if;

    insert into public.tenants (name, type)
    values (
      tenant_name,
      coalesce(meta->>'mode', 'INDEPENDENT')
    )
    returning id into new_tenant_id;
    
    assigned_role := 'ADMIN';
  end if;

  -- Create the Profile
  insert into public.profiles (
    id,
    tenant_id,
    first_name,
    last_name_paternal,
    last_name_maternal,
    role
  )
  values (
    new.id,
    new_tenant_id,
    meta->>'firstName',
    meta->>'lastNamePaternal',
    meta->>'lastNameMaternal',
    assigned_role
  );

  return new;
end;
$$;
