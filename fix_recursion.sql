-- ======================================================
-- 3. FIX RECURSION 500 ERROR (SECURITY DEFINER)
-- ======================================================

BEGIN;

-- 1. Create SECURITY DEFINER function to bypass RLS recursion
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER -- Bypasses RLS on the tables it queries
SET search_path = public -- Secure search_path
AS $$
BEGIN
  -- Check by email (Hardcoded rescue)
  IF auth.jwt() ->> 'email' IN ('helmerferras@gmail.com', 'helmerpersonal@gmail.com') THEN
    RETURN TRUE;
  END IF;

  -- Check by Role in DB
  -- Since this is SECURITY DEFINER, it can read profile_roles even if RLS blocks the user elsewhere
  IF EXISTS (SELECT 1 FROM public.profile_roles WHERE profile_id = auth.uid() AND role = 'SUPER_ADMIN') THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO service_role;

-- 2. Update Policies TO USE THE FUNCTION (No Recursion)

-- PROFILES
DROP POLICY IF EXISTS "Super Admin View All Profiles" ON public.profiles;
CREATE POLICY "Super Admin View All Profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING ( 
    public.is_super_admin() 
    OR 
    id = auth.uid() -- Users can always see themselves
);

-- PROFILE ROLES
DROP POLICY IF EXISTS "Super Admin View All Roles" ON public.profile_roles;
CREATE POLICY "Super Admin View All Roles"
ON public.profile_roles
FOR SELECT
TO authenticated
USING ( 
    public.is_super_admin() 
    OR 
    profile_id = auth.uid() -- Users can see their own roles
);

-- STUDENTS (Admin Visibility)
DROP POLICY IF EXISTS "Super Admin View All Students" ON public.students;
CREATE POLICY "Super Admin View All Students"
ON public.students
FOR SELECT
TO authenticated
USING ( 
  public.is_super_admin() 
  OR 
  tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()) -- Normal RLS
);

-- TENANTS
DROP POLICY IF EXISTS "Super Admin View All Tenants" ON public.tenants;
CREATE POLICY "Super Admin View All Tenants"
ON public.tenants
FOR SELECT
TO authenticated
USING ( 
    public.is_super_admin() 
    OR
    id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()) -- Users see their own tenant
);

COMMIT;
