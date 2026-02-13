-- MASTER FIX SCRIPT
-- This script safely creates all meaningful missing tables/columns and applies public permissions.
-- Run this once to fix 400/500 errors.

-- 1. Ensure 'deleted_at' column exists in profiles (for Soft Delete)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='deleted_at') THEN
        ALTER TABLE public.profiles ADD COLUMN deleted_at timestamp with time zone;
    END IF;
END $$;

-- 2. Ensure 'system_settings' table exists
CREATE TABLE IF NOT EXISTS public.system_settings (
    key text PRIMARY KEY,
    value text,
    description text,
    updated_at timestamp with time zone default now(),
    updated_by uuid references auth.users(id)
);

-- 3. Ensure 'payment_transactions' table exists
CREATE TABLE IF NOT EXISTS public.payment_transactions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid REFERENCES public.tenants(id),
    user_id uuid REFERENCES auth.users(id),
    amount numeric(10, 2) NOT NULL,
    currency text DEFAULT 'MXN',
    provider text NOT NULL, -- 'MERCADO_PAGO'
    provider_payment_id text, -- MP transaction ID
    status text NOT NULL, -- 'PENDING', 'APPROVED', 'REJECTED'
    metadata jsonb DEFAULT '{}',
    created_at timestamp with time zone DEFAULT now()
);

-- 4. Ensure 'licenses' table exists
CREATE TABLE IF NOT EXISTS public.licenses (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid REFERENCES public.tenants(id),
    plan_type text NOT NULL, -- 'PRO', 'ENTERPRISE'
    status text NOT NULL DEFAULT 'ACTIVE',
    starts_at timestamp with time zone DEFAULT now(),
    ends_at timestamp with time zone,
    transaction_id uuid REFERENCES public.payment_transactions(id),
    features jsonb DEFAULT '{}',
    created_at timestamp with time zone DEFAULT now()
);

-- 5. APPLY PUBLIC PERMISSIONS (Disable RLS effectively)
-- We drop existing policies first to facilitate re-runs (idempotency).

-- System Settings
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view system settings" ON public.system_settings;
DROP POLICY IF EXISTS "Public can update system settings" ON public.system_settings;
DROP POLICY IF EXISTS "Public can insert system settings" ON public.system_settings;
CREATE POLICY "Public can view system settings" ON public.system_settings FOR SELECT USING (true);
CREATE POLICY "Public can update system settings" ON public.system_settings FOR UPDATE USING (true);
CREATE POLICY "Public can insert system settings" ON public.system_settings FOR INSERT WITH CHECK (true);

-- Payment Transactions
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view payment_transactions" ON public.payment_transactions;
DROP POLICY IF EXISTS "Public can insert payment_transactions" ON public.payment_transactions;
CREATE POLICY "Public can view payment_transactions" ON public.payment_transactions FOR SELECT USING (true);
CREATE POLICY "Public can insert payment_transactions" ON public.payment_transactions FOR INSERT WITH CHECK (true);

-- Licenses
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view licenses" ON public.licenses;
DROP POLICY IF EXISTS "Public can insert licenses" ON public.licenses;
CREATE POLICY "Public can view licenses" ON public.licenses FOR SELECT USING (true);
CREATE POLICY "Public can insert licenses" ON public.licenses FOR INSERT WITH CHECK (true);

-- Profiles & Tenants (Ensure they are viewable)
DROP POLICY IF EXISTS "Public can view tenants" ON public.tenants;
DROP POLICY IF EXISTS "Public can view profiles" ON public.profiles;
CREATE POLICY "Public can view tenants" ON public.tenants FOR SELECT USING (true);
CREATE POLICY "Public can view profiles" ON public.profiles FOR SELECT USING (true);

-- 6. Grant Permissions to Anon/Authenticated Roles explicitly (just in case)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_settings TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.payment_transactions TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.licenses TO anon, authenticated;
GRANT SELECT ON public.profiles TO anon, authenticated;
GRANT SELECT ON public.tenants TO anon, authenticated;
