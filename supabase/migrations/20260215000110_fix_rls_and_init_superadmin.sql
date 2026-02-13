-- ==========================================
-- EMERGENCY FIX: RLS & SUPER ADMIN INITIALIZATION
-- ==========================================

BEGIN;

-- 1. Fix Profiles RLS (Allow viewing own profile even if tenant_id is NULL)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone in tenant" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles in own tenant" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users within same tenant can view each other" ON public.profiles
    FOR SELECT USING (
        tenant_id IS NOT NULL AND 
        tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    );

CREATE POLICY "Super Admins can view all profiles" ON public.profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profile_roles 
            WHERE profile_id = auth.uid() AND role = 'SUPER_ADMIN'
        )
    );

-- 2. Restore Super Admin Data Integrity
DO $$
DECLARE
    target_email text := 'helmerferras@gmail.com';
    target_uid uuid;
BEGIN
    SELECT id INTO target_uid FROM auth.users WHERE email = target_email;

    IF target_uid IS NOT NULL THEN
        -- Ensure profile has SUPER_ADMIN role and no tenant_id
        UPDATE public.profiles 
        SET role = 'SUPER_ADMIN', 
            tenant_id = NULL 
        WHERE id = target_uid;

        -- Ensure they have an ACTIVE subscription (so dashboard doesn't 406/404)
        INSERT INTO public.subscriptions (user_id, status, plan_type, current_period_end)
        VALUES (target_uid, 'active', 'ANNUAL', now() + interval '100 years')
        ON CONFLICT (user_id) DO UPDATE 
        SET status = 'active', current_period_end = now() + interval '100 years';

        RAISE NOTICE 'Initialized Super Admin profile and subscription for %', target_email;
    END IF;
END $$;

-- 3. Fix Subscriptions RLS (Just in case, though it looked okay)
DROP POLICY IF EXISTS "Users can read own subscription" ON public.subscriptions;
CREATE POLICY "Users can read own subscription" ON public.subscriptions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Super Admins can read all subscriptions" ON public.subscriptions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profile_roles 
            WHERE profile_id = auth.uid() AND role = 'SUPER_ADMIN'
        )
    );

COMMIT;
