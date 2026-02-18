
-- Force Delete User Script for 'helmerpersonal@gmail.com'
-- This script deletes everything related to this email to allow fresh registration.

BEGIN;

DO $$
DECLARE
    target_user_id UUID;
BEGIN
    -- 1. Find the user ID in auth.users
    SELECT id INTO target_user_id FROM auth.users WHERE email = 'helmerpersonal@gmail.com';

    -- 2. If not found in auth.users, try to find in profiles to be safe (orphaned profile)
    IF target_user_id IS NULL THEN
        SELECT id INTO target_user_id FROM public.profiles WHERE email = 'helmerpersonal@gmail.com';
    END IF;

    IF target_user_id IS NOT NULL THEN
        RAISE NOTICE 'Deleting user with ID: %', target_user_id;

        -- 3. Delete dependencies (Child tables first)
        -- Delete subscriptions
        DELETE FROM public.subscriptions WHERE user_id = target_user_id;
        
        -- Delete payment transactions
        DELETE FROM public.payment_transactions WHERE user_id = target_user_id;
        
        -- Delete profile roles
        DELETE FROM public.profile_roles WHERE profile_id = target_user_id;
        
        -- Delete profile tenants (links to schools)
        DELETE FROM public.profile_tenants WHERE profile_id = target_user_id;
        
        -- Delete from other tables if necessary (e.g. groups created by user, etc, though usually CASCADE handles this, manual is safer for cleanup)
        
        -- 4. Delete Profile
        DELETE FROM public.profiles WHERE id = target_user_id;

        -- 5. Delete from Auth (The Big Switch)
        DELETE FROM auth.users WHERE id = target_user_id;
        
        RAISE NOTICE 'User deleted successfully.';
    ELSE
        RAISE NOTICE 'User helmerpersonal@gmail.com not found.';
    END IF;
END $$;

COMMIT;
