-- ==========================================
-- REPAIR CURRENT WORKSPACE TO INDEPENDENT
-- ==========================================

BEGIN;

-- 1. Identify current workspace for the active user
WITH current_workspace AS (
    SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
)
-- 2. Update tenant type to INDEPENDENT
UPDATE public.tenants
SET type = 'INDEPENDENT'
WHERE id IN (SELECT tenant_id FROM current_workspace);

-- 3. Update role to INDEPENDENT_TEACHER in profile_tenants
UPDATE public.profile_tenants
SET role = 'INDEPENDENT_TEACHER'
WHERE profile_id = auth.uid() 
  AND tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid());

-- 4. Update core profile role
UPDATE public.profiles
SET role = 'INDEPENDENT_TEACHER'
WHERE id = auth.uid();

COMMIT;

NOTIFY pgrst, 'reload schema';
