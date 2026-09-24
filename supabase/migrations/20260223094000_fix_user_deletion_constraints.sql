-- Migration: Fix User Deletion Constraints
-- Description: Adds ON DELETE CASCADE to all foreign keys referencing auth.users(id) 
-- to allow seamless deletion of users from the dashboard.

BEGIN;

-- 1. Table: public.profiles
ALTER TABLE IF EXISTS public.profiles
DROP CONSTRAINT IF EXISTS profiles_id_fkey,
ADD CONSTRAINT profiles_id_fkey 
    FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Table: public.subscriptions
ALTER TABLE IF EXISTS public.subscriptions
DROP CONSTRAINT IF EXISTS subscriptions_user_id_fkey,
ADD CONSTRAINT subscriptions_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 3. Table: public.payment_transactions
ALTER TABLE IF EXISTS public.payment_transactions
DROP CONSTRAINT IF EXISTS payment_transactions_user_id_fkey,
ADD CONSTRAINT payment_transactions_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 4. Table: public.audit_logs
ALTER TABLE IF EXISTS public.audit_logs
DROP CONSTRAINT IF EXISTS audit_logs_changed_by_fkey,
ADD CONSTRAINT audit_logs_changed_by_fkey 
    FOREIGN KEY (changed_by) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 5. Table: public.license_keys
ALTER TABLE IF EXISTS public.license_keys
DROP CONSTRAINT IF EXISTS license_keys_created_by_fkey,
ADD CONSTRAINT license_keys_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE,
DROP CONSTRAINT IF EXISTS license_keys_redeemed_by_fkey,
ADD CONSTRAINT license_keys_redeemed_by_fkey 
    FOREIGN KEY (redeemed_by) REFERENCES auth.users(id) ON DELETE CASCADE;

COMMIT;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
