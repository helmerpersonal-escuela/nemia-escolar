-- Migration: God Mode Extras (System Settings & Monetization)
-- Description: Adds tables for system-wide settings (AI keys) and payment/license management.

-- 1. System Settings (Key-Value Store for Admin Configs)
CREATE TABLE IF NOT EXISTS public.system_settings (
    key text PRIMARY KEY,
    value text,
    description text,
    updated_at timestamp with time zone default now(),
    updated_by uuid references auth.users(id)
);

-- RLS for System Settings
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "SuperAdmins can view system settings" ON public.system_settings
FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'SUPER_ADMIN')
);

CREATE POLICY "SuperAdmins can update system settings" ON public.system_settings
FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'SUPER_ADMIN')
);

CREATE POLICY "SuperAdmins can insert system settings" ON public.system_settings
FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'SUPER_ADMIN')
);

-- 2. Payment Transactions (Mercado Pago / Stripe integration log)
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

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own payments" ON public.payment_transactions
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "SuperAdmins can view all payments" ON public.payment_transactions
FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'SUPER_ADMIN')
);

-- 3. Licenses
CREATE TABLE IF NOT EXISTS public.licenses (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid REFERENCES public.tenants(id),
    plan_type text NOT NULL, -- 'PRO', 'ENTERPRISE', 'S', 'M', 'L'
    status text NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'EXPIRED', 'SUSPENDED'
    starts_at timestamp with time zone DEFAULT now(),
    ends_at timestamp with time zone,
    transaction_id uuid REFERENCES public.payment_transactions(id),
    features jsonb DEFAULT '{}', -- Feature flags
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can view their active license" ON public.licenses
FOR SELECT USING (
    tenant_id IN (
        SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    )
);

CREATE POLICY "SuperAdmins can manage licenses" ON public.licenses
FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'SUPER_ADMIN')
);
