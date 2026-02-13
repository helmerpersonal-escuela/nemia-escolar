-- 20260215000094_fix_profile_tenants_role.sql

-- Updates the profile_tenants role to 'INDEPENDENT_TEACHER' for users who are associated with an INDEPENDENT tenant.
-- This is CRITICAL because useTenant hook derives the role from this table, not just the profiles table.

UPDATE public.profile_tenants
SET role = 'INDEPENDENT_TEACHER'
WHERE tenant_id IN (
    SELECT id FROM public.tenants WHERE type = 'INDEPENDENT'
);
