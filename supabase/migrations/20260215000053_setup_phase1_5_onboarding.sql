-- Phase 1.5: Onboarding Schema Updates
-- Adds columns for School Details, Location, and Avatar

-- 1. Update TENANTS table (School Information)
alter table public.tenants 
add column if not exists educational_level text check (educational_level in ('PRESCHOOL', 'PRIMARY', 'SECONDARY', 'HIGH_SCHOOL', 'UNIVERSITY', 'OTHER')),
add column if not exists cct text, -- Clave de Centro de Trabajo
add column if not exists phone text,
add column if not exists address text,
add column if not exists location_lat double precision,
add column if not exists location_lng double precision,
add column if not exists logo_url text, -- Storage URL
add column if not exists onboarding_completed boolean default false;

-- 2. Update PROFILES table (User Personalization)
alter table public.profiles
add column if not exists avatar_url text; -- Can be internal path or external URL

-- 3. Update/Recreate the Trigger Function to handle these new fields if passed in metadata
-- (We will update the function logic in a separate step or rely on a robust separate 'Onboarding API' call)
-- For now, the strategy is: 
-- Step 1 (Register): Create Account (Email, Pass, Names).
-- Step 2 (Wizard): Update Tenant/Profile via standard API calls (RLS allows Admin to update own tenant).

-- Ensure RLS allows Admins to UPDATE their own Tenant details
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'tenants' AND policyname = 'Admins can update own tenant'
    ) THEN
        CREATE POLICY "Admins can update own tenant" ON public.tenants
for update
using (id = get_current_tenant_id());
    END IF;
END $$;
