-- Add PREFECT to staff attendance management
DROP POLICY IF EXISTS "Admins manage staff attendance" ON public.staff_attendance;
CREATE POLICY "Admins and Prefects manage staff attendance" ON public.staff_attendance
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('DIRECTOR', 'ADMIN', 'SUPER_ADMIN', 'PREFECT') 
        AND tenant_id = staff_attendance.tenant_id
    )
);

-- Ensure PREFECT can also view and update student incidents (already covered by 'Users can view incidents for their tenant', but good to be explicit for update if needed)
DROP POLICY IF EXISTS "Users can update incidents" ON public.student_incidents;
CREATE POLICY "Staff can update incidents for their tenant"
ON public.student_incidents FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('DIRECTOR', 'ADMIN', 'SUPER_ADMIN', 'PREFECT', 'TEACHER', 'ACADEMIC_COORD', 'TECH_COORD') 
        AND tenant_id = student_incidents.tenant_id
    )
);
