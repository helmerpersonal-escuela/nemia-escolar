-- SECURITY MIGRATION: GOD MODE LOCKDOWN
-- Target: Ensure ONLY 'helmerpersonal@outlook.com' is SUPER_ADMIN.
-- All other SUPER_ADMINs will be downgraded to ADMIN.

BEGIN;

-- 3. Apply Trigger
DROP TRIGGER IF EXISTS tr_enforce_super_admin ON public.profile_roles;

DO $$
DECLARE
    target_email text := 'helmerferras@gmail.com';
    target_uid uuid;
    r RECORD;
BEGIN
    -- 1. Get List of Unauthorized SUPER_ADMINS
    FOR r IN
        SELECT profile_id
        FROM public.profile_roles
        WHERE role = 'SUPER_ADMIN'
        AND profile_id NOT IN (SELECT id FROM auth.users WHERE email = target_email)
    LOOP
        -- Check if they ALREADY have ADMIN role
        -- If YES -> Delete the SUPER_ADMIN row (they keep ADMIN)
        -- If NO -> Update SUPER_ADMIN to ADMIN
        
        IF EXISTS (SELECT 1 FROM public.profile_roles WHERE profile_id = r.profile_id AND role = 'ADMIN') THEN
            DELETE FROM public.profile_roles 
            WHERE profile_id = r.profile_id AND role = 'SUPER_ADMIN';
            RAISE NOTICE 'Removed duplicate SUPER_ADMIN role for user % (already ADMIN)', r.profile_id;
        ELSE
            UPDATE public.profile_roles 
            SET role = 'ADMIN' 
            WHERE profile_id = r.profile_id AND role = 'SUPER_ADMIN';
            RAISE NOTICE 'Downgraded SUPER_ADMIN to ADMIN for user %', r.profile_id;
        END IF;
    END LOOP;

    -- 2. Upgrade the target user to SUPER_ADMIN
    SELECT id INTO target_uid FROM auth.users WHERE email = target_email;

    IF target_uid IS NOT NULL THEN
        -- Link profile_roles
        INSERT INTO public.profile_roles (profile_id, role)
        VALUES (target_uid, 'SUPER_ADMIN')
        ON CONFLICT (profile_id, role) DO NOTHING;
        
        -- Try to update email in profiles IF it exists
        BEGIN
            EXECUTE 'UPDATE public.profiles SET email = $1 WHERE id = $2' USING target_email, target_uid;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not check/update email check in profiles table. Ignoring.';
        END;
        
        RAISE NOTICE 'Upgraded % to SUPER_ADMIN.', target_email;
    ELSE
        RAISE NOTICE 'Target user % NOT FOUND. Please sign up first!', target_email;
    END IF;
END $$;

-- 4. Create a Trigger to PREVENT assigning SUPER_ADMIN to anyone else

CREATE OR REPLACE FUNCTION public.enforce_super_admin_limit()
RETURNS TRIGGER AS $$
DECLARE
    target_email text := 'helmerferras@gmail.com';
    user_email text;
BEGIN
    -- Allow removing SUPER_ADMIN (downgrade)
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;

    -- If adding/updating to SUPER_ADMIN
    IF (NEW.role = 'SUPER_ADMIN') THEN
        -- Check auth.users for email
        SELECT email INTO user_email FROM auth.users WHERE id = NEW.profile_id;
        
        IF user_email IS DISTINCT FROM target_email THEN
            RAISE EXCEPTION 'Security Violation: Only % can be SUPER_ADMIN.', target_email;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_enforce_super_admin
BEFORE INSERT OR UPDATE ON public.profile_roles
FOR EACH ROW EXECUTE FUNCTION public.enforce_super_admin_limit();

COMMIT;

