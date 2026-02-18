-- Migration: Add Two-Tier Licensing System
-- Description: Creates license_limits table and adds plan_type to subscriptions

-- 1. Create license_limits table
CREATE TABLE IF NOT EXISTS license_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_type VARCHAR(20) UNIQUE NOT NULL CHECK (plan_type IN ('basic', 'pro')),
    max_groups INTEGER NOT NULL,
    max_students_per_group INTEGER NOT NULL,
    price_annual DECIMAL(10,2) NOT NULL,
    trial_days INTEGER DEFAULT 30,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add plan_type column to subscriptions if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'subscriptions' AND column_name = 'plan_type'
    ) THEN
        ALTER TABLE subscriptions 
        ADD COLUMN plan_type VARCHAR(20) DEFAULT 'basic' CHECK (plan_type IN ('basic', 'pro'));
    END IF;
END $$;

-- 3. Insert license limits data
INSERT INTO license_limits (plan_type, max_groups, max_students_per_group, price_annual, trial_days) 
VALUES 
    ('basic', 2, 50, 399.00, 30),
    ('pro', 5, 50, 599.00, 30)
ON CONFLICT (plan_type) DO UPDATE SET
    max_groups = EXCLUDED.max_groups,
    max_students_per_group = EXCLUDED.max_students_per_group,
    price_annual = EXCLUDED.price_annual,
    trial_days = EXCLUDED.trial_days,
    updated_at = NOW();

-- 4. Update existing subscriptions to have basic plan
UPDATE subscriptions 
SET plan_type = 'basic' 
WHERE plan_type IS NULL;

-- 5. Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_type ON subscriptions(plan_type);

-- 6. Add RLS policies for license_limits (read-only for authenticated users)
ALTER TABLE license_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view license limits" ON license_limits;
CREATE POLICY "Anyone can view license limits" ON license_limits
    FOR SELECT
    TO authenticated
    USING (true);

-- 7. Comment the tables
COMMENT ON TABLE license_limits IS 'Defines limits and pricing for different subscription plans';
COMMENT ON COLUMN subscriptions.plan_type IS 'Type of subscription plan: basic (2 groups) or pro (5 groups)';
