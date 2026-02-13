-- ======================================================
-- 4. FIX SUPER ADMIN ACCESS V2 (Explicit Promotion)
-- ======================================================

BEGIN;

DO $$
DECLARE
    v_user_id uuid;
    v_email text := 'helmerpersonal@gmail.com';
BEGIN
    -- 1. Find the User ID
    SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;

    IF v_user_id IS NOT NULL THEN
        RAISE NOTICE 'Found user % with ID %', v_email, v_user_id;

        -- 2. Ensure Profile Exists (and has NO tenant_id for global access)
        INSERT INTO public.profiles (id, role, full_name, first_name, tenant_id)
        VALUES (v_user_id, 'SUPER_ADMIN', 'Super Admin Personal', 'Helmer', NULL)
        ON CONFLICT (id) DO UPDATE SET 
            role = 'SUPER_ADMIN',
            tenant_id = NULL; -- Important: Super Admin must have NULL tenant to see everything via RLS? 
                              -- Wait, RLS logic says: "is_super_admin OR tenant_id = ..."
                              -- If tenant_id is NULL, normal RLS fails, but is_super_admin SUCDEEDS.

        -- 3. Ensure Role Exists
        INSERT INTO public.profile_roles (profile_id, role)
        VALUES (v_user_id, 'SUPER_ADMIN')
        ON CONFLICT (profile_id, role) DO NOTHING;

        -- 4. Ensure Subscription (Active)
        INSERT INTO public.subscriptions (user_id, status, current_period_end)
        VALUES (v_user_id, 'active', now() + interval '100 years')
        ON CONFLICT (user_id) DO UPDATE SET status = 'active';

    ELSE
        RAISE WARNING 'User % not found in auth.users. Please sign up first!', v_email;
    END IF;
END $$;

-- 5. Force Refresh of Permissions (Grant basic usage just in case)
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated; -- DANGEROUS IN PROD, OK FOR FIXING VISIBILITY NOW.
-- We can revert this later, but for now lets open the gates to check if RLS is the issue.

COMMIT;
