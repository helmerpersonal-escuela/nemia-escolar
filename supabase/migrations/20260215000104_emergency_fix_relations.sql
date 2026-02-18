-- EMERGENCY FIX: RELATIONS & PERMISSIONS
-- 1. Fix "Bad Request" on Relations: Point FKs to 'profiles' instead of 'auth.users'
-- PostgREST cannot automatically join auth.users, but it CAN join public.profiles.

DO $$
BEGIN
    -- Fix payment_transactions FK
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='payment_transactions_user_id_fkey') THEN
        ALTER TABLE public.payment_transactions DROP CONSTRAINT payment_transactions_user_id_fkey;
    END IF;
    
    ALTER TABLE public.payment_transactions 
    ADD CONSTRAINT payment_transactions_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.profiles(id);

    -- 1.1 Ensure columns exist before adding constraints
    -- system_settings.updated_by
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='system_settings' AND column_name='updated_by') THEN
        ALTER TABLE public.system_settings ADD COLUMN updated_by uuid;
    END IF;

    -- payment_transactions.user_id (Should exist, but safety first)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payment_transactions' AND column_name='user_id') THEN
        ALTER TABLE public.payment_transactions ADD COLUMN user_id uuid;
    END IF;

    -- 1.2 Fix system_settings FK (updated_by)
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='system_settings_updated_by_fkey') THEN
        ALTER TABLE public.system_settings DROP CONSTRAINT system_settings_updated_by_fkey;
    END IF;

    ALTER TABLE public.system_settings 
    ADD CONSTRAINT system_settings_updated_by_fkey 
    FOREIGN KEY (updated_by) REFERENCES public.profiles(id);

END $$;

-- 2. Verify 'deleted_at' again (Force add if missing)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='deleted_at') THEN
        ALTER TABLE public.profiles ADD COLUMN deleted_at timestamp with time zone;
    END IF;
END $$;

-- 3. Reset Permissions (Grant ALL to anon/service_role to be absolutely sure)
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- 4. Reload Schema Cache
NOTIFY pgrst, 'reload config';
