-- Migration: Correcting Joins and FKs for God Mode (FINAL)
-- Description: Consolidates all business table FKs to point to public.profiles instead of auth.users.
-- This resolves PGRST201 Ambiguous Embedding error by ensuring there is only one path to profiles.

BEGIN;

-- 1. SUBSCRIPTIONS
-- Drop original FK to auth.users if it exists (usually automatic name)
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_user_id_fkey;
-- Drop intermediate fix FK if it exists
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_user_id_fkey_profiles;
-- Create single, clean FK to public.profiles
ALTER TABLE public.subscriptions 
ADD CONSTRAINT subscriptions_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


-- 2. PAYMENT TRANSACTIONS
-- Drop original FK to auth.users if it exists
ALTER TABLE public.payment_transactions DROP CONSTRAINT IF EXISTS payment_transactions_user_id_fkey;
-- Drop intermediate fix FK if it exists
ALTER TABLE public.payment_transactions DROP CONSTRAINT IF EXISTS payment_transactions_user_id_fkey_profiles;
-- Create single, clean FK to public.profiles
ALTER TABLE public.payment_transactions 
ADD CONSTRAINT payment_transactions_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


-- 3. LICENSE KEYS
-- Handle created_by
ALTER TABLE public.license_keys DROP CONSTRAINT IF EXISTS license_keys_created_by_fkey;
ALTER TABLE public.license_keys DROP CONSTRAINT IF EXISTS license_keys_created_by_fkey_profiles;
ALTER TABLE public.license_keys 
ADD CONSTRAINT license_keys_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Handle redeemed_by
ALTER TABLE public.license_keys DROP CONSTRAINT IF EXISTS license_keys_redeemed_by_fkey;
ALTER TABLE public.license_keys DROP CONSTRAINT IF EXISTS license_keys_redeemed_by_fkey_profiles;
ALTER TABLE public.license_keys 
ADD CONSTRAINT license_keys_redeemed_by_fkey 
FOREIGN KEY (redeemed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMIT;
