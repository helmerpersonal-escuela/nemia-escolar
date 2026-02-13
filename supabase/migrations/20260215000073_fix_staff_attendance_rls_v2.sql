-- Refactor staff_attendance RLS again to allow self-registration for ALL staff
DROP POLICY IF EXISTS "Admins and Prefects manage staff attendance" ON public.staff_attendance;
DROP POLICY IF EXISTS "Users can view own attendance" ON public.staff_attendance;

-- Policy for management (Insert/Update/Delete)
CREATE POLICY "Staff can manage their own attendance and Admins/Prefects manage all"
ON public.staff_attendance
FOR ALL
TO authenticated
USING (
    tenant_id = get_current_tenant_id() AND (
        profile_id = auth.uid() OR
        get_current_role() IN ('DIRECTOR', 'ADMIN', 'SUPER_ADMIN', 'PREFECT')
    )
)
WITH CHECK (
    tenant_id = get_current_tenant_id() AND (
        profile_id = auth.uid() OR
        get_current_role() IN ('DIRECTOR', 'ADMIN', 'SUPER_ADMIN', 'PREFECT')
    )
);

-- Policy for viewing (already covered by ALL above, but keeping it explicit for clarity if needed)
-- Actually, ALL covers SELECT, INSERT, UPDATE, DELETE.
