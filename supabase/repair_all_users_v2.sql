-- ROBUST REPAIR SCRIPT
-- 1. Find the MOST RECENTLY CREATED user (assumed to be the one that worked, e.g. test2).
-- 2. Copy its instance_id to all demo users.
-- 3. Restore the trigger with the SAFE version.

BEGIN;

DO $$
DECLARE
    v_valid_instance_id uuid;
    v_source_user_email text;
BEGIN
    -- 1. Get valid ID from the latest user created (ignoring seeds if possible, taking the absolute latest)
    SELECT instance_id, email INTO v_valid_instance_id, v_source_user_email
    FROM auth.users
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_valid_instance_id IS NULL THEN
        RAISE EXCEPTION 'No users found in auth.users!';
    END IF;

    RAISE NOTICE 'Found valid instance_id: % from user %', v_valid_instance_id, v_source_user_email;

    -- 2. Fix Demo Users
    UPDATE auth.users
    SET instance_id = v_valid_instance_id
    WHERE email LIKE '%@demo.com'
    AND instance_id IS DISTINCT FROM v_valid_instance_id;
    
    RAISE NOTICE 'Updated instance_id for all demo users.';

END $$;

-- 3. Restore the SAFE TRIGGER (Optional but recommended for future signups)
ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;

COMMIT;
