-- Fix infinite recursion by using SECURITY DEFINER functions to bypass RLS for role/tenant checks

-- 1. Helper: Get own tenant_id without triggering RLS
CREATE OR REPLACE FUNCTION get_own_tenant_id_bypass()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT tenant_id FROM public.profiles WHERE id = auth.uid();
$$;

-- 2. Helper: Check if user has a specific role without triggering RLS
CREATE OR REPLACE FUNCTION has_role_bypass(p_role text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profile_roles
    WHERE profile_id = auth.uid()
    AND role = p_role
  );
$$;

-- 3. Check if user is Super Admin (common check)
CREATE OR REPLACE FUNCTION is_super_admin_bypass()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profile_roles
    WHERE profile_id = auth.uid()
    AND role = 'SUPER_ADMIN'
  );
$$;

-- 4. Fix "profiles" table policies
DROP POLICY IF EXISTS "Users within same tenant can view each other" ON public.profiles;
CREATE POLICY "Users within same tenant can view each other" ON public.profiles
FOR SELECT USING (
    tenant_id IS NOT NULL AND
    tenant_id = get_own_tenant_id_bypass()
);

DROP POLICY IF EXISTS "Super Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "SuperAdmins can view all profiles" ON public.profiles; -- Drop potentially alternate named policy
CREATE POLICY "Super Admins can view all profiles" ON public.profiles
FOR SELECT USING (
    is_super_admin_bypass()
);

-- 5. Fix "profile_roles" table policies
DROP POLICY IF EXISTS "Admins can manage roles in their tenant" ON public.profile_roles;
CREATE POLICY "Admins can manage roles in their tenant" ON public.profile_roles
FOR ALL USING (
    has_role_bypass('SUPER_ADMIN') OR
    has_role_bypass('ADMIN') OR
    has_role_bypass('DIRECTOR')
);

-- 6. Fix "tenants" table policies (checking for superadmin recursion there too)
DROP POLICY IF EXISTS "SuperAdmins can view all tenants" ON public.tenants;
CREATE POLICY "SuperAdmins can view all tenants" ON public.tenants
FOR SELECT USING (
    is_super_admin_bypass()
);
