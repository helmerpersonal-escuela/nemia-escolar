-- This migration dynamically finds and modifies foreign keys that relate to user identity (profiles, subscriptions, student_tutor_users)
-- and changes them to ON DELETE CASCADE. This is necessary to allow users to be hard-deleted from
-- the Supabase Dashboard without violating foreign key constraints.

DO $$
DECLARE
    rec_fk RECORD;
BEGIN
    -- 1. Modify constraints linking to auth.users ON DELETE CASCADE
    -- We target profiles, student_tutor_users, system_settings, news_announcements
    FOR rec_fk IN (
        SELECT 
            tc.table_name, 
            tc.constraint_name,
            kcu.column_name
        FROM 
            information_schema.table_constraints AS tc 
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
              AND ccu.table_schema = tc.table_schema
        WHERE 
            ccu.table_name = 'users' 
            AND ccu.table_schema = 'auth'
            AND tc.table_schema = 'public'
            AND tc.table_name IN ('profiles', 'student_tutor_users')
    ) LOOP
        EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I;', rec_fk.table_name, rec_fk.constraint_name);
        EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES auth.users(id) ON DELETE CASCADE;', rec_fk.table_name, rec_fk.constraint_name, rec_fk.column_name);
    END LOOP;

    -- 2. Modify constraints linking to auth.users ON DELETE SET NULL (for audit/settings where tracking isn't critical but table must remain)
    FOR rec_fk IN (
        SELECT 
            tc.table_name, 
            tc.constraint_name,
            kcu.column_name
        FROM 
            information_schema.table_constraints AS tc 
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
              AND ccu.table_schema = tc.table_schema
        WHERE 
            ccu.table_name = 'users' 
            AND ccu.table_schema = 'auth'
            AND tc.table_schema = 'public'
            AND tc.table_name IN ('system_settings', 'news_announcements')
    ) LOOP
        -- Make column nullable if necessary
        EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I DROP NOT NULL;', rec_fk.table_name, rec_fk.column_name);
        EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I;', rec_fk.table_name, rec_fk.constraint_name);
        EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES auth.users(id) ON DELETE SET NULL;', rec_fk.table_name, rec_fk.constraint_name, rec_fk.column_name);
    END LOOP;

    -- 3. Modify core personal data constraints linking to public.profiles ON DELETE CASCADE
    FOR rec_fk IN (
        SELECT 
            tc.table_name, 
            tc.constraint_name,
            kcu.column_name
        FROM 
            information_schema.table_constraints AS tc 
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
              AND ccu.table_schema = tc.table_schema
        WHERE 
            ccu.table_name = 'profiles' 
            AND ccu.table_schema = 'public'
            AND tc.table_schema = 'public'
            AND tc.table_name IN ('subscriptions', 'payment_transactions', 'profile_subjects')
    ) LOOP
        EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I;', rec_fk.table_name, rec_fk.constraint_name);
        EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.profiles(id) ON DELETE CASCADE;', rec_fk.table_name, rec_fk.constraint_name, rec_fk.column_name);
    END LOOP;

    -- We intentionally leave 'lesson_plans', 'student_evaluations' etc unmodified to PREVENT accidental deletion 
    -- of active school data if a teacher is deleted. The deletion from Supabase Dashboard will fail if the user 
    -- actually has active lesson plans, which protects the school's records.

END $$;
