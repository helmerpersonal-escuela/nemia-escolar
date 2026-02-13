-- Fix Onboarding Default Value

-- 1. Update existing nulls to false
UPDATE public.tenants
SET onboarding_completed = false
WHERE onboarding_completed IS NULL;

-- 2. Alter column to default to false
ALTER TABLE public.tenants
ALTER COLUMN onboarding_completed SET DEFAULT false;

-- 3. Ensure it is NOT NULL (optional, but good practice if we always want a value)
-- ALTER TABLE public.tenants ALTER COLUMN onboarding_completed SET NOT NULL; 
-- (Skipping NOT NULL enforcement to avoid potential breakage if there's weird data, but setting Default is key)
