-- FIX INFINITE RECURSION
-- The policy "SuperAdmins can view all profiles" queries 'public.profiles' itself to check the role.
-- This causes an infinite loop: Select Profile -> Trigger Policy -> Select Profile -> Trigger Policy...

-- We must DROP this specific policy.
-- The "Public can view profiles" policy (created in ...0200) is sufficient for now (USING true).

DROP POLICY IF EXISTS "SuperAdmins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "SuperAdmins can view all tenants" ON public.tenants;

-- Ensure Public policies are still there and active
DROP POLICY IF EXISTS "Public can view profiles" ON public.profiles;
CREATE POLICY "Public can view profiles" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view tenants" ON public.tenants;
CREATE POLICY "Public can view tenants" ON public.tenants FOR SELECT USING (true);

-- Also fix system_settings just in case
DROP POLICY IF EXISTS "SuperAdmins can view system settings" ON public.system_settings;
