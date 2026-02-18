-- Migration: Add License Keys System
-- Description: Creates license_keys table and redemption RPC

-- 1. Create license_keys table
CREATE TABLE IF NOT EXISTS public.license_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    plan_type TEXT NOT NULL CHECK (plan_type IN ('basic', 'pro')),
    duration_days INTEGER NOT NULL DEFAULT 30, -- How long the license lasts (e.g. 30 days, 365 days)
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'redeemed', 'revoked')),
    created_by UUID REFERENCES auth.users(id),
    redeemed_by UUID REFERENCES auth.users(id),
    redeemed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ, -- Optional expiration for the key itself
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_license_keys_code ON public.license_keys(code);
CREATE INDEX IF NOT EXISTS idx_license_keys_status ON public.license_keys(status);

-- 3. RLS
ALTER TABLE public.license_keys ENABLE ROW LEVEL SECURITY;

-- Super Admins can do everything
CREATE POLICY "Super Admins can manage license keys" ON public.license_keys
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'SUPER_ADMIN'
        )
    );

-- 4. RPC to redeem a license key
CREATE OR REPLACE FUNCTION public.redeem_license_key(key_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_key_record RECORD;
    v_user_id UUID;
    v_subscription_id UUID;
BEGIN
    v_user_id := auth.uid();
    
    -- Check if key exists and is valid
    SELECT * INTO v_key_record
    FROM public.license_keys
    WHERE code = key_code
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > NOW());
      
    IF v_key_record.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Licencia inválida o expirada.');
    END IF;

    -- Update Key Status
    UPDATE public.license_keys
    SET status = 'redeemed',
        redeemed_by = v_user_id,
        redeemed_at = NOW()
    WHERE id = v_key_record.id;

    -- Update/Upsert Subscription
    -- If it's a trial key (duration < 32 days), force BASIC plan unless specified otherwise by logic (but here we trust the key's plan_type)
    -- User specified: "el mes gratis sera solo para el plan basicas"
    -- So we should ensure keys generated for 'free trial' (30 days) are likely BASIC.
    -- However, the key itself has a plan_type. We will trust the key creator (Super Admin) to set it correctly.
    
    INSERT INTO public.subscriptions (user_id, status, plan_type, current_period_end)
    VALUES (
        v_user_id, 
        'active', 
        v_key_record.plan_type, 
        NOW() + (v_key_record.duration_days || ' days')::INTERVAL
    )
    ON CONFLICT (user_id) 
    DO UPDATE SET 
        status = 'active',
        plan_type = EXCLUDED.plan_type,
        current_period_end = GREATEST(subscriptions.current_period_end, NOW()) + (v_key_record.duration_days || ' days')::INTERVAL,
        updated_at = NOW();

    RETURN jsonb_build_object('success', true, 'message', 'Licencia canjeada exitosamente.');
END;
$$;
