-- SUBSCRIPTIONS AND PAYMENTS SCHEMA

BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status') THEN
        CREATE TYPE public.subscription_status AS ENUM (
            'trialing', 'active', 'past_due', 'canceled', 'unpaid'
        );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plan_interval') THEN
        CREATE TYPE public.plan_interval AS ENUM (
            'month', 'year'
        );
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.subscriptions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) NOT NULL,
    status public.subscription_status NOT NULL DEFAULT 'trialing',
    plan_type text NOT NULL DEFAULT 'ANNUAL', -- 'ANNUAL' or 'MONTHLY' (but we only have annual)
    current_period_start timestamptz NOT NULL DEFAULT now(),
    current_period_end timestamptz NOT NULL,
    cancel_at_period_end boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    mercadopago_subscription_id text,
    mercadopago_customer_id text,
    CONSTRAINT subscriptions_user_id_key UNIQUE (user_id) -- One subscription per user for now
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON public.subscriptions(status);

-- RLS Policies
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can read their own subscription
-- Users can read their own subscription
DROP POLICY IF EXISTS "Users can read own subscription" ON public.subscriptions;
CREATE POLICY "Users can read own subscription" ON public.subscriptions
    FOR SELECT
    USING (auth.uid() = user_id);

-- Only Service Role (Edge Functions) can insert/update/delete
-- (Implicitly denied for anon/authenticated unless we add policy)
-- But we might need update for testing? No, keep it strict. 
-- Wait, system triggers might need to update it?
-- We'll allow SERVICE_ROLE full access by default (Supabase default).

-- Updates: Allow users to cancel? Maybe update `cancel_at_period_end`?
-- For now, updates via API/Edge Function is safer.

-- Add RLS to Profiles to allow Service Role to update `subscription_status` if efficient?
-- Actually, let's keep subscription details in `subscriptions` table.

-- 3. Payment Transactions Log (Auditing)
-- Drop existing if it was created by older migrations
DROP TABLE IF EXISTS public.payment_transactions CASCADE;

CREATE TABLE IF NOT EXISTS public.payment_transactions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    subscription_id uuid REFERENCES public.subscriptions(id),
    tenant_id uuid REFERENCES public.tenants(id),
    user_id uuid REFERENCES auth.users(id),
    amount decimal(10,2) NOT NULL,
    currency text DEFAULT 'MXN',
    status text NOT NULL, -- 'approved', 'rejected', 'pending'
    provider text NOT NULL DEFAULT 'MERCADO_PAGO',
    provider_payment_id text UNIQUE, -- MP Payment ID
    created_at timestamptz DEFAULT now(),
    meta jsonb DEFAULT '{}'::jsonb
);

-- Ensure subscriptions has trial logic
-- Adding a few helper columns if needed (already handled by current_period_end)
-- Let's add a default trial period if we wanted to automate it via trigger,
-- but for now we'll handle it in the webhook/app logic.

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

-- Users see their own transactions
-- Users see their own transactions
DROP POLICY IF EXISTS "Users see own transactions" ON public.payment_transactions;
CREATE POLICY "Users see own transactions" ON public.payment_transactions
    FOR SELECT
    USING (
        subscription_id IN (
            SELECT id FROM public.subscriptions WHERE user_id = auth.uid()
        )
    );

-- 4. Auto-Trial Trigger for New Users
CREATE OR REPLACE FUNCTION public.handle_new_user_trial()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.subscriptions (user_id, status, plan_type, current_period_end)
    VALUES (NEW.id, 'trialing', 'ANNUAL', now() + interval '30 days')
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if trigger exists on auth.users (requires superuser or handled via Supabase dashboard)
-- In a migration, we can't always Target auth.users directly unless we have permissions.
-- However, we can try to apply it to a public table that triggers on auth events if available,
-- but the standard way is auth.users.
DROP TRIGGER IF EXISTS on_auth_user_created_trial ON auth.users;
CREATE TRIGGER on_auth_user_created_trial
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_trial();

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_subscriptions_updated ON public.subscriptions;
CREATE TRIGGER on_subscriptions_updated
    BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

COMMIT;
