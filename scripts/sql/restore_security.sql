-- ======================================================
-- 8. RESTORE SECURITY & RLS (Undo Nuclear Option)
-- ======================================================

BEGIN;

-- 1. RE-ENABLE Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

-- 2. Ensure Security Definer Function (The Key to Admin Access)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER -- Critical: Bypasses RLS to check permissions
SET search_path = public
AS $$
BEGIN
  -- 1. Hardcoded Rescue for Owner
  IF auth.jwt() ->> 'email' IN ('helmerferras@gmail.com', 'helmerpersonal@gmail.com') THEN
    RETURN TRUE;
  END IF;

  -- 2. Check Role in DB (Bypassing RLS thanks to SECURITY DEFINER)
  IF EXISTS (SELECT 1 FROM public.profile_roles WHERE profile_id = auth.uid() AND role = 'SUPER_ADMIN') THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO service_role;

-- 3. RE-APPLY POLICIES (That allow Super Admin to see everything)

-- PROFILES
DROP POLICY IF EXISTS "Super Admin View All Profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can see profiles" ON public.profiles; -- Remove the temporary open policy
CREATE POLICY "Super Admin View All Profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING ( 
    public.is_super_admin() 
    OR 
    id = auth.uid() 
    OR
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()) -- Neighbors in same tenant
);

-- STUDENTS
DROP POLICY IF EXISTS "Super Admin View All Students" ON public.students;
CREATE POLICY "Super Admin View All Students"
ON public.students
FOR SELECT
TO authenticated
USING ( 
  public.is_super_admin() 
  OR 
  tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
);

-- TENANTS
DROP POLICY IF EXISTS "Super Admin View All Tenants" ON public.tenants;
CREATE POLICY "Super Admin View All Tenants"
ON public.tenants
FOR SELECT
TO authenticated
USING ( 
    public.is_super_admin() 
    OR
    id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
);

COMMIT;
