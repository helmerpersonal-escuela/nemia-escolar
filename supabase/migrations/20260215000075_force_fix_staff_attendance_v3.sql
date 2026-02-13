-- Ultra-simplified RLS for staff_attendance
-- PURGE ALL PREVIOUS ATTEMPTS
DO $$ 
BEGIN
    -- Common names from previous attempts
    DROP POLICY IF EXISTS "Admins and Prefects manage staff attendance" ON public.staff_attendance;
    DROP POLICY IF EXISTS "Admins manage staff attendance" ON public.staff_attendance;
    DROP POLICY IF EXISTS "Users can view own attendance" ON public.staff_attendance;
    DROP POLICY IF EXISTS "Staff can manage their own attendance and Admins/Prefects manage all" ON public.staff_attendance;
    DROP POLICY IF EXISTS "staff_attendance_management_v4" ON public.staff_attendance;
    DROP POLICY IF EXISTS "staff_attendance_trusted_v9" ON public.staff_attendance;
    DROP POLICY IF EXISTS "staff_attendance_final_attempt" ON public.staff_attendance;
END $$;

-- 1. SELF-REGISTRATION POLICY (Owners)
CREATE POLICY "attendance_self_v1"
ON public.staff_attendance
FOR ALL
TO authenticated
USING (profile_id = auth.uid())
WITH CHECK (profile_id = auth.uid());

-- 2. ADMINISTRATIVE POLICY (Admins/Prefects)
CREATE POLICY "attendance_admin_v1"
ON public.staff_attendance
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('DIRECTOR', 'ADMIN', 'SUPER_ADMIN', 'PREFECT', 'ACADEMIC_COORD', 'TECH_COORD')
        AND profiles.tenant_id = public.staff_attendance.tenant_id
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('DIRECTOR', 'ADMIN', 'SUPER_ADMIN', 'PREFECT', 'ACADEMIC_COORD', 'TECH_COORD')
        AND profiles.tenant_id = public.staff_attendance.tenant_id
    )
);

-- 3. INTER-TENANT PROTECTION (Safety layer)
-- Ensure no one can see rows from other tenants even if they guess a profile_id
ALTER TABLE public.staff_attendance FORCE ROW LEVEL SECURITY;
