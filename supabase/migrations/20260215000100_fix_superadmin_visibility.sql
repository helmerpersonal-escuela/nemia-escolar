-- Migration: Fix SuperAdmin Visibility
-- Description: Ensures SUPER_ADMIN can see all tenants and profiles regardless of personal tenant association.

-- 1. Update RLS for tenants
DROP POLICY IF EXISTS "SuperAdmins can view all tenants" ON public.tenants;
CREATE POLICY "SuperAdmins can view all tenants" ON public.tenants
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'SUPER_ADMIN'
    )
);

-- 2. Update RLS for profiles
DROP POLICY IF EXISTS "SuperAdmins can view all profiles" ON public.profiles;
CREATE POLICY "SuperAdmins can view all profiles" ON public.profiles
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'SUPER_ADMIN'
    )
);

-- 3. Temporal "Libre" Mode for development (Optional, but user asked for it)
-- This allows viewing even if role isn't set, ONLY for the dashboard query if we can't get role yet.
-- To minimize risk, we only allow it for the authenticated user helmerferras@gmail.com
-- OR we just allow it for all during this phase if specifically requested "dejalo libre".

-- Let's stick to the SuperAdmin role fix first, but also let's make helmerferras@gmail.com SUPER_ADMIN via migration
DO $$
BEGIN
    -- Try to find the user helmerferras@gmail.com and elevate them
    UPDATE public.profiles 
    SET role = 'SUPER_ADMIN'
    WHERE id IN (SELECT id FROM auth.users WHERE email = 'helmerferras@gmail.com');

    INSERT INTO public.profile_roles (profile_id, role)
    SELECT id, 'SUPER_ADMIN' 
    FROM auth.users WHERE email = 'helmerferras@gmail.com'
    ON CONFLICT DO NOTHING;
END $$;
