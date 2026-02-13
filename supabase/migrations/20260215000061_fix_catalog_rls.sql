-- Migration: Enable RLS on public catalogs and system settings
-- This fixes security warnings and ensures consistent access policies.

-- 1. Evaluation Criteria Catalog
ALTER TABLE IF EXISTS public.evaluation_criteria_catalog ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'evaluation_criteria_catalog' AND policyname = 'Public Read Access for Catalog'
    ) THEN
        CREATE POLICY "Public Read Access for Catalog"
        ON public.evaluation_criteria_catalog FOR SELECT
        USING (true); -- Publicly readable
    END IF;
END $$;

-- 2. System Settings (if not already enabled)
ALTER TABLE IF EXISTS public.system_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'system_settings' AND policyname = 'Authenticated Users Read Settings'
    ) THEN
        CREATE POLICY "Authenticated Users Read Settings"
        ON public.system_settings FOR SELECT
        TO authenticated
        USING (true);
    END IF;
END $$;
