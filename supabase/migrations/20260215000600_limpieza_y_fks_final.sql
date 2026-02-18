-- Migration: God Mode Join Fix (NUCLEAR CLEAN & REPAIR)
-- Description: Cleans any records without a profile and sets up unambiguous FKs.

BEGIN;

-- A. CLEANUP (Remove records pointing to non-existent profiles)
DELETE FROM public.subscriptions WHERE user_id NOT IN (SELECT id FROM public.profiles);
DELETE FROM public.payment_transactions WHERE user_id NOT IN (SELECT id FROM public.profiles);
DELETE FROM public.license_keys WHERE created_by NOT IN (SELECT id FROM public.profiles) AND created_by IS NOT NULL;
DELETE FROM public.license_keys WHERE redeemed_by NOT IN (SELECT id FROM public.profiles) AND redeemed_by IS NOT NULL;

-- B. SUBSCRIPTIONS
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_user_id_fkey;
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_user_id_fkey_profiles;
ALTER TABLE public.subscriptions 
ADD CONSTRAINT subscriptions_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- C. PAYMENT TRANSACTIONS
ALTER TABLE public.payment_transactions DROP CONSTRAINT IF EXISTS payment_transactions_user_id_fkey;
ALTER TABLE public.payment_transactions DROP CONSTRAINT IF EXISTS payment_transactions_user_id_fkey_profiles;
ALTER TABLE public.payment_transactions 
ADD CONSTRAINT payment_transactions_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- D. LICENSE KEYS
ALTER TABLE public.license_keys DROP CONSTRAINT IF EXISTS license_keys_created_by_fkey;
ALTER TABLE public.license_keys DROP CONSTRAINT IF EXISTS license_keys_created_by_fkey_profiles;
ALTER TABLE public.license_keys 
ADD CONSTRAINT license_keys_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.license_keys DROP CONSTRAINT IF EXISTS license_keys_redeemed_by_fkey;
ALTER TABLE public.license_keys DROP CONSTRAINT IF EXISTS license_keys_redeemed_by_fkey_profiles;
ALTER TABLE public.license_keys 
ADD CONSTRAINT license_keys_redeemed_by_fkey 
FOREIGN KEY (redeemed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMIT;
