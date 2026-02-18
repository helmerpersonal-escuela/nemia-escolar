-- ======================================================
-- 2. FIX SUPER ADMIN VISIBILITY
-- ======================================================

BEGIN;

-- 1. Ensure RLS is enabled on key tables (just in case)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_roles ENABLE ROW LEVEL SECURITY;

-- 2. Create Policy for Super Admin to View All Profiles
DROP POLICY IF EXISTS "Super Admin View All Profiles" ON public.profiles;
CREATE POLICY "Super Admin View All Profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
    (SELECT role FROM public.profile_roles WHERE profile_id = auth.uid() AND role = 'SUPER_ADMIN') IS NOT NULL
    OR
    auth.jwt() ->> 'email' IN ('helmerferras@gmail.com', 'helmerpersonal@gmail.com')
);

-- 3. Create Policy for Super Admin to View All Roles
DROP POLICY IF EXISTS "Super Admin View All Roles" ON public.profile_roles;
CREATE POLICY "Super Admin View All Roles"
ON public.profile_roles
FOR SELECT
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.profile_roles WHERE profile_id = auth.uid() AND role = 'SUPER_ADMIN')
    OR
    auth.jwt() ->> 'email' IN ('helmerferras@gmail.com', 'helmerpersonal@gmail.com')
);

-- 4. Create Policy for Super Admin to View All Tenants
DROP POLICY IF EXISTS "Super Admin View All Tenants" ON public.tenants;
CREATE POLICY "Super Admin View All Tenants"
ON public.tenants
FOR SELECT
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.profile_roles WHERE profile_id = auth.uid() AND role = 'SUPER_ADMIN')
    OR
    auth.jwt() ->> 'email' IN ('helmerferras@gmail.com', 'helmerpersonal@gmail.com')
);

-- 5. Fix Payment Transactions FK if missing (Duplicate check to be safe)
DO $$ 
BEGIN
    ALTER TABLE public.payment_transactions
      DROP CONSTRAINT IF EXISTS payment_transactions_user_id_fkey;

    ALTER TABLE public.payment_transactions
      ADD CONSTRAINT payment_transactions_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id);
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

COMMIT;
