-- ======================================================
-- 9. FIX RLS RECURSION (FINAL) - SECURITY DEFINER HELPER
-- ======================================================

BEGIN;

-- 1. Create Helper Function to get My Tenant ID safely (bypassing RLS)
CREATE OR REPLACE FUNCTION public.get_my_tenant_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER -- Crucial: Bypasses RLS on profiles table
SET search_path = public
STABLE
AS $$
  SELECT tenant_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_tenant_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_tenant_id() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_my_tenant_id() TO anon;

-- 2. Update Profiles Policy to use Helper Function
DROP POLICY IF EXISTS "Super Admin View All Profiles" ON public.profiles;
CREATE POLICY "Super Admin View All Profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING ( 
    -- 1. Super Admin sees everything
    public.is_super_admin() 
    OR 
    -- 2. User sees themselves
    id = auth.uid() 
    OR
    -- 3. User sees neighbors in same tenant (using helper function to avoid recursion)
    tenant_id = public.get_my_tenant_id()
);

-- 3. Update Tenants Policy
DROP POLICY IF EXISTS "Super Admin View All Tenants" ON public.tenants;
CREATE POLICY "Super Admin View All Tenants"
ON public.tenants
FOR SELECT
TO authenticated
USING ( 
    public.is_super_admin() 
    OR
    id = public.get_my_tenant_id()
);

-- 4. Update Students Policy
DROP POLICY IF EXISTS "Super Admin View All Students" ON public.students;
CREATE POLICY "Super Admin View All Students"
ON public.students
FOR SELECT
TO authenticated
USING ( 
  public.is_super_admin() 
  OR 
  tenant_id = public.get_my_tenant_id()
);

COMMIT;
