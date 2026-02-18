-- FIX: Handle User Registration via Trigger (Bypasses RLS issues)

-- 1. Create the Function that runs when a user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  new_tenant_id uuid;
  meta jsonb;
  tenant_name text;
  full_name text;
begin
  -- Get metadata from the auth.users payload
  meta := new.raw_user_meta_data;
  
  -- Determine Tenant Name: Prioritize organizationName, fallback to person name
  tenant_name := meta->>'organizationName';
  
  if tenant_name is null or trim(tenant_name) = '' then
    -- For Independent or if empty, construct name from user parts
    tenant_name := trim(
      coalesce(meta->>'firstName', '') || ' ' || 
      coalesce(meta->>'lastNamePaternal', '') || ' ' || 
      coalesce(meta->>'lastNameMaternal', '')
    );
  end if;

  -- Create the Tenant
  insert into public.tenants (name, type)
  values (
    tenant_name,
    meta->>'mode'
  )
  returning id into new_tenant_id;

  -- Create the Profile linked to the user and the new tenant
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
    'ADMIN' -- The creator is always the Admin
  );

  return new;
end;
$$;

-- 2. Create the Trigger
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute procedure public.handle_new_user();

-- 3. Cleanup RLS Policies (Optional but good practice)
-- Use this query to ensure we don't have conflicting client-side policies later if you want
-- drop policy "Enable insert for authenticated users" on public.tenants;
