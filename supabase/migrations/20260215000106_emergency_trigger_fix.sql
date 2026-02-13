-- EMERGENCY TRIGGER FIX
-- Diagnosis: User creation in Dashboard fails with "Database error", blocking debugging.
-- Solution: Wrap the trigger logic in a BEGIN...EXCEPTION block to log errors but ALLOW user creation.

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
  -- SAFE BLOCK: Try to do the logic, but don't crash the auth transaction if it fails.
  BEGIN
      meta := new.raw_user_meta_data;
      
      -- Extract basic info (Safely handle nulls)
      first_name := coalesce(meta->>'firstName', '');
      last_name_paternal := coalesce(meta->>'lastNamePaternal', '');
      last_name_maternal := coalesce(meta->>'lastNameMaternal', '');
      
      -- 1. PRIORITY: Check for explicit tenantId
      target_tenant_id := (meta->>'tenantId')::uuid;
      
      if target_tenant_id is not null then
        -- Verify tenant exists
        perform 1 from public.tenants where id = target_tenant_id;
        if found then
            new_tenant_id := target_tenant_id;
            assigned_role := coalesce(meta->>'role', 'TEACHER');
        end if;
      end if;
    
      -- 2. PRIORITY: Check for Invitation
      if new_tenant_id is null then
          inv_token := (meta->>'invitationToken')::uuid;
          if inv_token is not null then
            select * into inv_record from staff_invitations 
            where token = inv_token and status = 'PENDING' and expires_at > now();
        
            if found then
               new_tenant_id := inv_record.tenant_id;
               assigned_role := inv_record.role;
               
               -- Mark invitation as accepted
               update staff_invitations set status = 'ACCEPTED' where id = inv_record.id;
            end if;
          end if;
      end if;
    
      -- 3. FALLBACK: New School
      if new_tenant_id is null then
        tenant_name := meta->>'organizationName';
        
        if tenant_name is null or trim(tenant_name) = '' then
          tenant_name := trim(first_name || ' ' || last_name_paternal || ' ' || last_name_maternal);
          if trim(tenant_name) = '' then
              tenant_name := 'Nueva Escuela (Sin Nombre)'; 
          end if;
        end if;
    
        insert into public.tenants (name, type)
        values (
          tenant_name,
          coalesce(meta->>'mode', 'SCHOOL')
        )
        returning id into new_tenant_id;
        
        assigned_role := 'ADMIN'; 
      end if;
    
      -- 4. Create Profile
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
        first_name,
        last_name_paternal,
        last_name_maternal,
        assigned_role
      );
      
      -- 5. Role Binding
      insert into public.profile_roles (profile_id, role)
      values (new.id, assigned_role)
      on conflict do nothing;

  EXCEPTION WHEN OTHERS THEN
      -- Log the error (visible in Postgres logs) but DO NOT FAIL the transaction
      RAISE WARNING 'Error in handle_new_user trigger: % %', SQLERRM, SQLSTATE;
      -- We return NEW anyway so the user is created in auth.users
      RETURN NEW;
  END;

  return new;
end;
$$;
