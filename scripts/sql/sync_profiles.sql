-- ======================================================
-- 7. SYNC USERS TO PROFILES (FIX MISSING DATA)
-- ======================================================

BEGIN;

-- 1. Ensure 'email' column exists in profiles (Frontend needs it)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;

-- 2. Sync Metadata from auth.users to public.profiles
-- This inserts profiles for any user in auth.users that is missing from specific table
INSERT INTO public.profiles (id, email, full_name, first_name, role, tenant_id)
SELECT 
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'full_name', 'Usuario Sin Nombre'),
    COALESCE(au.raw_user_meta_data->>'first_name', 'Usuario'),
    'TEACHER', -- Default role so they appear in lists
    NULL -- Global tenant for now, or specific if needed
FROM auth.users au
ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email, -- Update email if changed
    role = COALESCE(public.profiles.role, 'TEACHER'); -- Ensure role is not null

-- 3. Update specific Demo Users to be INDEPENDENT_TEACHER and linked to Demo Tenant
UPDATE public.profiles
SET 
    role = 'INDEPENDENT_TEACHER',
    tenant_id = '77777777-7777-7777-7777-777777777777',
    is_demo = true
WHERE email IN ('usuario@prueba.com', 'test@nemia.com', 'demo.nemia@test.com');

-- 4. Ensure Helmer is Super Admin
UPDATE public.profiles
SET role = 'SUPER_ADMIN', tenant_id = NULL
WHERE email IN ('helmerferras@gmail.com', 'helmerpersonal@gmail.com');

-- 5. Force Role entries in profile_roles
INSERT INTO public.profile_roles (profile_id, role)
SELECT id, role FROM public.profiles
ON CONFLICT (profile_id, role) DO NOTHING;

COMMIT;
