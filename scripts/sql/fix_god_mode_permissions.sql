-- ======================================================
-- God Mode: Grant Full CRUD Permissions to Super Admins
-- ======================================================

BEGIN;

-- 1. Ensure is_super_admin function is robust
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  v_email := auth.jwt() ->> 'email';

  -- 1. Hardcoded Rescue for Owner
  IF v_email IN ('helmerferras@gmail.com', 'helmerpersonal@gmail.com', 'helmerferra@gmail.com', 'admin@nemia.com') THEN
    RETURN TRUE;
  END IF;

  -- 2. Check Role in DB (Bypassing RLS thanks to SECURITY DEFINER)
  IF EXISTS (SELECT 1 FROM public.profile_roles WHERE profile_id = auth.uid() AND role = 'SUPER_ADMIN') THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$;

-- 2. Helper for Stats (Fixes 404 in Dashboard)
CREATE OR REPLACE FUNCTION public.get_database_size()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Return total size of project database in bytes
    RETURN pg_database_size(current_database());
END;
$$;

-- 3. Grant EXECUTE permissions on administrative functions
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_database_size() TO authenticated;
GRANT EXECUTE ON FUNCTION public.soft_delete_account(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_account(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purge_account(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purge_auth_user_by_email(text) TO authenticated;

-- 4. MASTER POLICIES: Grant Full Access to Super Admin on critical tables
-- Profiles
DROP POLICY IF EXISTS "Super Admin Master Access" ON public.profiles;
CREATE POLICY "Super Admin Master Access"
ON public.profiles
FOR ALL
TO authenticated
USING ( public.is_super_admin() )
WITH CHECK ( public.is_super_admin() );

-- Tenants
DROP POLICY IF EXISTS "Super Admin Master Access" ON public.tenants;
CREATE POLICY "Super Admin Master Access"
ON public.tenants
FOR ALL
TO authenticated
USING ( public.is_super_admin() )
WITH CHECK ( public.is_super_admin() );

-- Students
DROP POLICY IF EXISTS "Super Admin Master Access" ON public.students;
CREATE POLICY "Super Admin Master Access"
ON public.students
FOR ALL
TO authenticated
USING ( public.is_super_admin() )
WITH CHECK ( public.is_super_admin() );

-- Assignments
DROP POLICY IF EXISTS "Super Admin Master Access" ON public.assignments;
CREATE POLICY "Super Admin Master Access"
ON public.assignments
FOR ALL
TO authenticated
USING ( public.is_super_admin() )
WITH CHECK ( public.is_super_admin() );

COMMIT;
