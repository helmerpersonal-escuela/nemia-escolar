-- Create get_current_role helper
CREATE OR REPLACE FUNCTION get_current_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- Refactor staff_attendance RLS
DROP POLICY IF EXISTS "Admins and Prefects manage staff attendance" ON public.staff_attendance;
DROP POLICY IF EXISTS "Admins manage staff attendance" ON public.staff_attendance;

CREATE POLICY "Admins and Prefects manage staff attendance"
ON public.staff_attendance
FOR ALL
TO authenticated
USING (
    tenant_id = get_current_tenant_id() AND
    get_current_role() IN ('DIRECTOR', 'ADMIN', 'SUPER_ADMIN', 'PREFECT')
)
WITH CHECK (
    tenant_id = get_current_tenant_id() AND
    get_current_role() IN ('DIRECTOR', 'ADMIN', 'SUPER_ADMIN', 'PREFECT')
);

-- Also ensure users can view their own attendance (useful for teachers later)
DROP POLICY IF EXISTS "Users can view own attendance" ON public.staff_attendance;
CREATE POLICY "Users can view own attendance"
ON public.staff_attendance
FOR SELECT
TO authenticated
USING (
    profile_id = auth.uid() OR
    get_current_role() IN ('DIRECTOR', 'ADMIN', 'SUPER_ADMIN', 'PREFECT')
);
