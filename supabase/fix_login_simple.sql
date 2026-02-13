-- FIX LOGIN 500 ERROR (Simplified)
-- Diagnosis: The created users have a placeholder instance_id ('00000000-0000-0000-0000-000000000000').
-- In a hosted Supabase project, this mismatch likely causes the Auth server to crash (500) when verifying login.

BEGIN;

DO $$
DECLARE
    v_proper_instance_id uuid;
BEGIN
    -- 1. Try to find a valid instance_id (from a user NOT created by our demo script)
    SELECT instance_id INTO v_proper_instance_id 
    FROM auth.users 
    WHERE email NOT LIKE '%@demo.com' 
    LIMIT 1;

    IF v_proper_instance_id IS NOT NULL THEN
        RAISE NOTICE 'Found proper instance_id: %. Updating demo users...', v_proper_instance_id;
        
        -- Fix all demo users to use the correct instance_id
        UPDATE auth.users 
        SET instance_id = v_proper_instance_id
        WHERE email LIKE '%@demo.com' 
        AND instance_id IS DISTINCT FROM v_proper_instance_id;
        
    ELSE
        RAISE NOTICE 'No non-demo users found to copy instance_id from.';
        -- If we can't find one, maybe we can query it? 
        -- Or just warn the user.
        -- We will try to update to NULL if it was 0000... just in case 0000... scares the server.
        
        UPDATE auth.users 
        SET instance_id = NULL
        WHERE email LIKE '%@demo.com' 
        AND instance_id = '00000000-0000-0000-0000-000000000000';
    END IF;

    -- 2. Verify and Fix Password (just in case 'bf' vs 'argon2' matters, though 'bf' should work)
    -- We can't re-encrypt easily without the raw password, but '123456' with bf is generally supported.
    -- If login still fails, user might need to reset password via dashboard for one user to test.

END $$;

COMMIT;
