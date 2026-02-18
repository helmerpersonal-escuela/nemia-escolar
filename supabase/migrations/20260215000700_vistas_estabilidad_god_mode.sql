-- Migration: God Mode Stability (VIEWS LAYER - REPAIRED)
-- Description: Creates pre-joined views using auth.users for email.

BEGIN;

-- 1. VIEW FOR SUBSCRIPTIONS
CREATE OR REPLACE VIEW public.view_god_mode_subscriptions AS
SELECT 
    s.*,
    u.email as user_email,
    p.first_name as user_first_name,
    p.last_name_paternal as user_last_name,
    p.avatar_url as user_avatar_url
FROM public.subscriptions s
LEFT JOIN public.profiles p ON s.user_id = p.id
LEFT JOIN auth.users u ON s.user_id = u.id;

-- 2. VIEW FOR TRANSACTIONS
CREATE OR REPLACE VIEW public.view_god_mode_transactions AS
SELECT 
    pt.*,
    u.email as user_email,
    p.first_name as user_first_name
FROM public.payment_transactions pt
LEFT JOIN public.profiles p ON pt.user_id = p.id
LEFT JOIN auth.users u ON pt.user_id = u.id;

-- 3. VIEW FOR LICENSE KEYS
CREATE OR REPLACE VIEW public.view_god_mode_license_keys AS
SELECT 
    lk.*,
    cu.email as creator_email,
    ru.email as redeemer_email
FROM public.license_keys lk
LEFT JOIN auth.users cu ON lk.created_by = cu.id
LEFT JOIN auth.users ru ON lk.redeemed_by = ru.id;

-- Grant permissions
GRANT SELECT ON public.view_god_mode_subscriptions TO authenticated;
GRANT SELECT ON public.view_god_mode_transactions TO authenticated;
GRANT SELECT ON public.view_god_mode_license_keys TO authenticated;

GRANT SELECT ON public.view_god_mode_subscriptions TO service_role;
GRANT SELECT ON public.view_god_mode_transactions TO service_role;
GRANT SELECT ON public.view_god_mode_license_keys TO service_role;

COMMIT;
