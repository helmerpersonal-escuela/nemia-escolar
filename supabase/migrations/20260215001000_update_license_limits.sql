-- Migration: Update License Limits for Basic and Pro Plans
-- Description: Increases max_groups for basic (2 -> 5) and pro (5 -> 10).

BEGIN;

-- 1. Update license_limits table
UPDATE public.license_limits 
SET 
    max_groups = CASE 
        WHEN plan_type = 'basic' THEN 5
        WHEN plan_type = 'pro' THEN 10
        ELSE max_groups
    END,
    updated_at = NOW()
WHERE plan_type IN ('basic', 'pro');

-- 2. Update comments to reflect new limits
COMMENT ON COLUMN subscriptions.plan_type IS 'Type of subscription plan: basic (5 groups) or pro (10 groups)';

COMMIT;

-- Force schema cache reload
NOTIFY pgrst, 'reload schema';
