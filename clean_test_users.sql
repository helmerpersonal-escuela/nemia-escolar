
-- Function to clean up a user and their tenant completely
-- Usage: select clean_test_user('test@example.com');

create or replace function clean_test_user(target_email text)
returns void
language plpgsql
security definer
as $$
declare
  v_user_id uuid;
  v_tenant_id uuid;
begin
  -- 1. Get User ID
  select id into v_user_id from auth.users where email = target_email;
  
  if v_user_id is null then
    raise notice 'User % not found', target_email;
    return;
  end if;

  -- 2. Get Tenant ID (Assuming single tenant for cleanup simplicity)
  select tenant_id into v_tenant_id from public.profiles where id = v_user_id;
  
  if v_tenant_id is null then
     -- User exists but no profile/tenant? Just delete auth user
     delete from auth.users where id = v_user_id;
     raise notice 'User % deleted (had no tenant)', target_email;
     return;
  end if;

  raise notice 'Cleaning up User % with Tenant %', target_email, v_tenant_id;

  -- 3. Delete Tenant Data (Order matters for Foreign Keys)
  -- Phase 2+ Data
  delete from public.attendance where tenant_id = v_tenant_id;
  delete from public.grades where tenant_id = v_tenant_id;
  delete from public.assignments where tenant_id = v_tenant_id;
  delete from public.lesson_plans where tenant_id = v_tenant_id;
  delete from public.analytical_programs where tenant_id = v_tenant_id;
  
  -- Phase 2 Core
  delete from public.students where tenant_id = v_tenant_id;
  delete from public.groups where tenant_id = v_tenant_id;
  delete from public.academic_years where tenant_id = v_tenant_id;
  
  -- Phase 1 Data
  delete from public.profile_subjects where tenant_id = v_tenant_id;
  delete from public.school_details where tenant_id = v_tenant_id;
  delete from public.school_announcements where tenant_id = v_tenant_id;
  


  -- 4. Delete Profile Links
  delete from public.profile_tenants where tenant_id = v_tenant_id;
  delete from public.profile_roles where profile_id = v_user_id;

  -- 5. Delete Financial & Audit Data
  delete from public.payment_transactions where user_id = v_user_id;
  delete from public.subscriptions where user_id = v_user_id;
  
  -- Handle Audit Logs (referencing user)
  -- Check if table exists to avoid errors in strict environments, though here we know it does.
  -- Deleting logs where this user was the actor
  delete from public.audit_logs where changed_by = v_user_id;
  
  -- 6. Delete Profile (referencing tenant)
  delete from public.profiles where id = v_user_id;
  
  -- 7. Delete Tenant
  delete from public.tenants where id = v_tenant_id;
  
  -- 8. Delete Auth User
  delete from auth.users where id = v_user_id;
  
  raise notice 'Cleanup complete for %', target_email;
end;
$$;
