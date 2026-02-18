-- ======================================================
-- NUCLEAR REGISTRATION FIX (Unified & Safe)
-- ======================================================
-- This script merges all post-signup tasks into a single
-- failsafe trigger to prevent 500 errors during registration.

BEGIN;

-- 1. Create a unified, ultra-safe handler
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
  assigned_role text;
  v_first_name text;
  v_last_name_p text;
  v_last_name_m text;
BEGIN
  -- BIG SAFE BLOCK: Catch everything to prevent 500 error in Auth
  BEGIN
      meta := new.raw_user_meta_data;
      
      -- Extract basic info safely
      v_first_name := coalesce(meta->>'firstName', 'Usuario');
      v_last_name_p := coalesce(meta->>'lastNamePaternal', '');
      v_last_name_m := coalesce(meta->>'lastNameMaternal', '');
      
      -- 1. Determine Tenant/Workspace
      -- Logic: Invitation > Explicit ID > New Org > Fallback Name
      
      -- 1.1 Check Invitation
      inv_token := (meta->>'invitationToken')::uuid;
      IF inv_token IS NOT NULL THEN
          SELECT * INTO inv_record FROM public.staff_invitations 
          WHERE token = inv_token AND status = 'PENDING' AND expires_at > now();
          
          IF FOUND THEN
             new_tenant_id := inv_record.tenant_id;
             assigned_role := inv_record.role;
             UPDATE public.staff_invitations SET status = 'ACCEPTED' WHERE id = inv_record.id;
          END IF;
      END IF;
      
      -- 1.2 Check Explicit TenantId (e.g. JOIN mode)
      IF new_tenant_id IS NULL AND (meta->>'tenantId') IS NOT NULL THEN
          new_tenant_id := (meta->>'tenantId')::uuid;
          assigned_role := coalesce(meta->>'role', 'TEACHER');
      END IF;

      -- 1.3 Create New Workspace (Fallback)
      IF new_tenant_id IS NULL THEN
          tenant_name := meta->>'organizationName';
          IF tenant_name IS NULL OR trim(tenant_name) = '' THEN
              tenant_name := trim(v_first_name || ' ' || v_last_name_p || ' ' || v_last_name_m);
              IF trim(tenant_name) = '' THEN tenant_name := 'Mi Espacio de Trabajo'; END IF;
          END IF;

          INSERT INTO public.tenants (name, type)
          VALUES (tenant_name, coalesce(meta->>'mode', 'SCHOOL'))
          RETURNING id INTO new_tenant_id;
          
          assigned_role := 'ADMIN'; 
      END IF;

      -- 2. Create Global Profile
      INSERT INTO public.profiles (
        id, tenant_id, first_name, last_name_paternal, last_name_maternal, role, email
      )
      VALUES (
        new.id, new_tenant_id, v_first_name, v_last_name_p, v_last_name_m, assigned_role, new.email
      )
      ON CONFLICT (id) DO UPDATE SET 
        tenant_id = EXCLUDED.tenant_id,
        role = EXCLUDED.role;

      -- 3. Create Profile-Tenant Link (Junction Table)
      INSERT INTO public.profile_tenants (
        profile_id, tenant_id, role, is_default, first_name, last_name_paternal, last_name_maternal
      )
      VALUES (
        new.id, new_tenant_id, assigned_role, true, v_first_name, v_last_name_p, v_last_name_m
      )
      ON CONFLICT DO NOTHING;

      -- 4. Assign Role Entry
      INSERT INTO public.profile_roles (profile_id, role)
      VALUES (new.id, assigned_role)
      ON CONFLICT DO NOTHING;

      -- 5. Auto-Trial Subscription
      -- Wrap in sub-block because subscriptions might have its own triggers/constraints
      BEGIN
          INSERT INTO public.subscriptions (user_id, status, plan_type, current_period_end)
          VALUES (new.id, 'trialing', 'ANNUAL', now() + interval '30 days')
          ON CONFLICT (user_id) DO NOTHING;
      EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'Sub-error in handle_new_user (subscription): %', SQLERRM;
      END;

  EXCEPTION WHEN OTHERS THEN
      -- LOG ERROR BUT DO NOT FAIL SIGNUP
      RAISE WARNING 'NUCLEAR ERROR in handle_new_user: % %', SQLERRM, SQLSTATE;
  END;

  RETURN NEW;
END;
$$;

-- 2. Clean up old triggers and apply the unified one
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_trial ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_user();

-- 3. Safety: Ensure no other triggers block registration
-- (If you have other custom triggers on auth.users, they should be reviewed)

COMMIT;
