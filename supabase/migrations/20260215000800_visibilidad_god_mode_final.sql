-- Migration: God Mode Visibility Fix (RLS BYPASS)
-- Description: Ensures Super Admin can actually see all records by fixing policy dependencies.

BEGIN;

-- 1. Helper function to check Super Admin status safely (bypassing RLS)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'SUPER_ADMIN'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Apply to Profiles
DROP POLICY IF EXISTS "Super Admins can view all profiles" ON public.profiles;
CREATE POLICY "Super Admins can view all profiles" ON public.profiles
    FOR SELECT USING (public.is_super_admin());

-- 3. Apply to Subscriptions
DROP POLICY IF EXISTS "Super Admins can read all subscriptions" ON public.subscriptions;
CREATE POLICY "Super Admins can read all subscriptions" ON public.subscriptions
    FOR SELECT USING (public.is_super_admin());

-- 4. Apply to profile_roles (Critical for the chain of trust)
ALTER TABLE public.profile_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own roles" ON public.profile_roles;
CREATE POLICY "Users can view own roles" ON public.profile_roles
    FOR SELECT USING (auth.uid() = profile_id OR public.is_super_admin());

-- 5. Apply to license_keys
ALTER TABLE public.license_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Everyone can see licenses in God Mode" ON public.license_keys;
CREATE POLICY "Super Admins can see all licenses" ON public.license_keys
    FOR SELECT USING (public.is_super_admin());

-- 6. Apply to payment_transactions
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Super Admins can see all transactions" ON public.payment_transactions;
CREATE POLICY "Super Admins can see all transactions" ON public.payment_transactions
    FOR SELECT USING (public.is_super_admin());

COMMIT;
NOTIFY pgrst, 'reload schema';
