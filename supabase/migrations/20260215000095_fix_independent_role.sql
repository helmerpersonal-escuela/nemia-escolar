-- 20260215000093_fix_independent_role.sql

-- Updates the profile role to 'INDEPENDENT_TEACHER' for users who are associated with an INDEPENDENT tenant.
-- This ensures they see the correct dashboard and have the correct permissions.

UPDATE public.profiles
SET role = 'INDEPENDENT_TEACHER'
WHERE id IN (
    SELECT profile_id 
    FROM public.user_tenants ut
    JOIN public.tenants t ON ut.tenant_id = t.id
    WHERE t.type = 'INDEPENDENT'
);

-- Also ensure the user_tenants table reflects the role if it has a role column (it usually does or uses profiles)
-- Assuming user_tenants might have a 'role' column in some schemas, but usually profiles is the source of truth for the app logic.
