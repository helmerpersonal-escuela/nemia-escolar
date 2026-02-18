-- Final attempt at fixing staff_attendance RLS
-- This migration drops ALL previous policy names and sets a clean, robust one.

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Staff can manage their own attendance and Admins/Prefects manage all" ON public.staff_attendance;
    DROP POLICY IF EXISTS "Admins and Prefects manage staff attendance" ON public.staff_attendance;
    DROP POLICY IF EXISTS "Admins manage staff attendance" ON public.staff_attendance;
    DROP POLICY IF EXISTS "Users can view own attendance" ON public.staff_attendance;
    DROP POLICY IF EXISTS "attendance_all_policy" ON public.staff_attendance;
    DROP POLICY IF EXISTS "staff_attendance_standard_policy" ON public.staff_attendance;
    DROP POLICY IF EXISTS "staff_attendance_v3" ON public.staff_attendance;
    DROP POLICY IF EXISTS "staff_attendance_resilient" ON public.staff_attendance;
END $$;

-- Enable RLS (just in case)
ALTER TABLE public.staff_attendance ENABLE ROW LEVEL SECURITY;

-- Clean, robust policy using explicit subqueries for maximum reliability
CREATE POLICY "staff_attendance_management_v4"
ON public.staff_attendance
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.tenant_id = public.staff_attendance.tenant_id
        AND (
            profiles.id = public.staff_attendance.profile_id OR
            profiles.role IN ('DIRECTOR', 'ADMIN', 'SUPER_ADMIN', 'PREFECT')
        )
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.tenant_id = public.staff_attendance.tenant_id
        AND (
            profiles.id = public.staff_attendance.profile_id OR
            profiles.role IN ('DIRECTOR', 'ADMIN', 'SUPER_ADMIN', 'PREFECT')
        )
    )
);

-- Ensure users can at least see all attendance in their tenant (useful for reports)
-- This replaces the selective VIEW if needed, but the ALL policy above is already quite good.
-- We'll add a specific SELECT policy for non-admin staff just to read others if needed (e.g. for visibility)
-- But for now, let's stick to the management one.
