-- ======================================================
-- 6. NUCLEAR OPTION: DISABLE RLS (TEMPORARY DIAGNOSTIC)
-- ======================================================

BEGIN;

-- 1. DISABLE Row Level Security completely on key tables
-- This means NO policies are checked. Everyone authenticated can see everything.
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.students DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments DISABLE ROW LEVEL SECURITY;

-- 2. Grant permissions explicitly (in case of missing grants)
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- 3. Ensure the current user (Helmer Ferras) is still Super Admin
DO $$
DECLARE
    v_user_id uuid := '57574904-e864-498c-b0a6-e0a14359d162';
BEGIN
    INSERT INTO public.profiles (id, role, full_name, first_name, tenant_id)
    VALUES (v_user_id, 'SUPER_ADMIN', 'Helmer Ferras', 'Helmer', NULL)
    ON CONFLICT (id) DO UPDATE SET 
        role = 'SUPER_ADMIN',
        tenant_id = NULL;

    INSERT INTO public.profile_roles (profile_id, role)
    VALUES (v_user_id, 'SUPER_ADMIN')
    ON CONFLICT (profile_id, role) DO NOTHING;
END $$;

COMMIT;
