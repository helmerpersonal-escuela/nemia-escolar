-- Migration: Prepare Database for Production
-- Description: Wipes all operational data and non-admin users.

BEGIN;

-- 1. Identify Super Admin IDs
DO $$
DECLARE
    admin_emails text[] := ARRAY['helmerferras@gmail.com', 'helmerpersonal@gmail.com'];
    admin_count int;
BEGIN
    SELECT count(*) INTO admin_count FROM auth.users WHERE email = ANY(admin_emails);
    
    IF admin_count = 0 THEN
        RAISE EXCEPTION 'Safety Check Failed: No Super Admin accounts found. Aborting cleanup.';
    END IF;

    -- 2. Delete all tenants (Cascades to almost everything in public schema)
    -- This includes: academic_years, groups, students, guardians, lesson_plans, assignments, grades, attendance, etc.
    DELETE FROM public.tenants;

    -- 3. Delete non-admin profiles
    DELETE FROM public.profiles 
    WHERE id NOT IN (SELECT id FROM auth.users WHERE email = ANY(admin_emails));

    -- 4. Delete non-admin profile roles
    DELETE FROM public.profile_roles
    WHERE profile_id NOT IN (SELECT id FROM auth.users WHERE email = ANY(admin_emails));

    -- 5. Clean up subscriptions and transactions
    DELETE FROM public.payment_transactions
    WHERE user_id NOT IN (SELECT id FROM auth.users WHERE email = ANY(admin_emails));

    DELETE FROM public.subscriptions
    WHERE user_id NOT IN (SELECT id FROM auth.users WHERE email = ANY(admin_emails));

    -- 6. Delete all auth users EXCEPT super admins
    -- Note: This requires high-level permissions usually handled by Supabase Dashboard, 
    -- but if executed via Super Admin context it should work for their metadata.
    -- If using service_role, it definitely works.
    DELETE FROM auth.users 
    WHERE email NOT IN (SELECT unnest(admin_emails));

    RAISE NOTICE 'Database cleanup completed. Operational data and non-admin users removed.';
END $$;

COMMIT;

-- Force PostgREST to refresh
NOTIFY pgrst, 'reload schema';
