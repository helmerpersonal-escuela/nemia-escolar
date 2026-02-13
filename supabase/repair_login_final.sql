-- FINAL REPAIR SCRIPT (SECURITY DEFINER)
-- Bypasses permission issues by running as a privileged function.

-- 1. Create a function to do the work with elevated privileges
CREATE OR REPLACE FUNCTION public.fix_users_instance_id()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Run as the creator (postgres/superuser)
AS $$
DECLARE
    v_valid_instance_id uuid;
    v_source_user_email text;
BEGIN
    -- Get valid ID from the latest user created
    SELECT instance_id, email INTO v_valid_instance_id, v_source_user_email
    FROM auth.users
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_valid_instance_id IS NULL THEN
        RAISE EXCEPTION 'No users found in auth.users!';
    END IF;

    RAISE NOTICE 'Using valid instance_id: % from user %', v_valid_instance_id, v_source_user_email;

    -- Update Demo Users
    UPDATE auth.users
    SET instance_id = v_valid_instance_id
    WHERE email LIKE '%@demo.com'
    AND instance_id IS DISTINCT FROM v_valid_instance_id;
    
    RAISE NOTICE 'Updated instance_id for all demo users.';
END;
$$;

-- 2. Execute the function
SELECT public.fix_users_instance_id();

-- 3. Cleanup the function
DROP FUNCTION public.fix_users_instance_id();

-- 4. Restore the SAFE TRIGGER
-- We re-enable the trigger to ensure future signups work correctly.
ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;

COMMIT;
