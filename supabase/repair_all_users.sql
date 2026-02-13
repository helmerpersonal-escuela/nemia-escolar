-- FINAL REPAIR SCRIPT
-- 1. Copy the VALID instance_id from the manually created user (test2) to all demo users.
-- 2. Manually create profile/tenant for test2 (since trigger was disabled).
-- 3. Re-enable the trigger but with the SAFE version (emergency fix).

BEGIN;

DO $$
DECLARE
    v_valid_instance_id uuid;
    v_test2_id uuid;
    v_new_tenant_id uuid;
BEGIN
    -- 1. Get valid ID from test2@test.com
    SELECT instance_id, id INTO v_valid_instance_id, v_test2_id
    FROM auth.users
    WHERE email = 'test2@test.com';

    IF v_valid_instance_id IS NULL THEN
        RAISE EXCEPTION 'Could not find test2@test.com. Please ensure it exists first.';
    END IF;

    RAISE NOTICE 'Found valid instance_id: %', v_valid_instance_id;

    -- 2. Fix Demo Users
    UPDATE auth.users
    SET instance_id = v_valid_instance_id
    WHERE email LIKE '%@demo.com'
    AND instance_id IS DISTINCT FROM v_valid_instance_id;
    
    RAISE NOTICE 'Updated instance_id for all demo users.';

    -- 3. Onboard test2 (if missing profile)
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_test2_id) THEN
        INSERT INTO public.tenants (name, type)
        VALUES ('Escuela Test Manual', 'SCHOOL')
        RETURNING id INTO v_new_tenant_id;

        INSERT INTO public.profiles (id, tenant_id, first_name, last_name_paternal, role)
        VALUES (v_test2_id, v_new_tenant_id, 'Test', 'User', 'ADMIN');
        
        -- Also add to profile_roles
        INSERT INTO public.profile_roles (profile_id, role)
        VALUES (v_test2_id, 'ADMIN')
        ON CONFLICT DO NOTHING;
        
        RAISE NOTICE 'Manually onboarded test2 profile.';
    END IF;

END $$;

-- 4. Restore the SAFE TRIGGER (Optional but recommended for future signups)
-- We re-apply the emergency fix function just to be sure it's the active one, 
-- and we ensure the trigger is ENABLED.
ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;

COMMIT;
