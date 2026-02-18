-- Migration: God Mode Master Alignment (THE FINAL BYPASS - REPAIRED)
-- Description: Ensures Super Admin authority is absolute and unambiguous.

BEGIN;

-- 1. DROP SECURITY TRIGGER TEMPORARILY TO ALLOW UPDATES
DROP TRIGGER IF EXISTS tr_enforce_super_admin ON public.profile_roles;

-- 2. Redefine a robust, recursion-free God Mode check
CREATE OR REPLACE FUNCTION public.is_god_mode()
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profile_roles
        WHERE profile_id = auth.uid() AND role = 'SUPER_ADMIN'
    ) OR EXISTS (
        SELECT 1 FROM auth.users
        WHERE id = auth.uid() AND email IN ('helmerferras@gmail.com', 'helmerpersonal@gmail.com')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- 3. Force authoritative role for known emails
UPDATE public.profiles 
SET role = 'SUPER_ADMIN', tenant_id = NULL 
WHERE id IN (SELECT id FROM auth.users WHERE email IN ('helmerferras@gmail.com', 'helmerpersonal@gmail.com'));

INSERT INTO public.profile_roles (profile_id, role)
SELECT id, 'SUPER_ADMIN' FROM auth.users WHERE email IN ('helmerferras@gmail.com', 'helmerpersonal@gmail.com')
ON CONFLICT (profile_id, role) DO NOTHING;

-- 4. Update the security trigger function to allow BOTH emails
CREATE OR REPLACE FUNCTION public.enforce_super_admin_limit()
RETURNS TRIGGER AS $$
DECLARE
    user_email text;
BEGIN
    -- Allow removing SUPER_ADMIN (downgrade)
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;

    -- If adding/updating to SUPER_ADMIN
    IF (NEW.role = 'SUPER_ADMIN') THEN
        -- Check auth.users for authorized emails
        SELECT email INTO user_email FROM auth.users WHERE id = NEW.profile_id;
        
        IF user_email NOT IN ('helmerferras@gmail.com', 'helmerpersonal@gmail.com') THEN
            RAISE EXCEPTION 'Security Violation: Only authorized emails can be SUPER_ADMIN.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Re-create the security trigger
CREATE TRIGGER tr_enforce_super_admin
BEFORE INSERT OR UPDATE ON public.profile_roles
FOR EACH ROW EXECUTE FUNCTION public.enforce_super_admin_limit();

-- 6. APPLY BYPASS POLICIES TO ALL CRITICAL TABLES

-- Table: profiles
DROP POLICY IF EXISTS "Super Admins can view all profiles" ON public.profiles;
CREATE POLICY "Super Admins can view all profiles" ON public.profiles
    FOR ALL USING (public.is_god_mode());

-- Table: tenants
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Super Admins can view all tenants" ON public.tenants;
CREATE POLICY "Super Admins can view all tenants" ON public.tenants
    FOR ALL USING (public.is_god_mode());

-- Table: profile_tenants
ALTER TABLE public.profile_tenants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Super Admins can view all links" ON public.profile_tenants;
CREATE POLICY "Super Admins can view all links" ON public.profile_tenants
    FOR ALL USING (public.is_god_mode());

-- Table: subscriptions
DROP POLICY IF EXISTS "Super Admins can read all subscriptions" ON public.subscriptions;
CREATE POLICY "Super Admins can read all subscriptions" ON public.subscriptions
    FOR ALL USING (public.is_god_mode());

-- Table: payment_transactions
DROP POLICY IF EXISTS "Super Admins can see all transactions" ON public.payment_transactions;
CREATE POLICY "Super Admins can see all transactions" ON public.payment_transactions
    FOR ALL USING (public.is_god_mode());

-- Table: license_keys
DROP POLICY IF EXISTS "Super Admins can see all licenses" ON public.license_keys;
CREATE POLICY "Super Admins can see all licenses" ON public.license_keys
    FOR ALL USING (public.is_god_mode());

-- Table: profile_roles (Ensure the chain doesn't break)
DROP POLICY IF EXISTS "Super Admins can view all roles" ON public.profile_roles;
CREATE POLICY "Super Admins can view all roles" ON public.profile_roles
    FOR ALL USING (public.is_god_mode());

-- 7. Fix potential orphan data again (Safety)
DELETE FROM public.subscriptions WHERE user_id NOT IN (SELECT id FROM auth.users);

COMMIT;
NOTIFY pgrst, 'reload schema';
