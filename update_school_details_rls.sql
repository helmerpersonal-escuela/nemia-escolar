-- Relax RLS for school_details to allow all authenticated users of the tenant to read
-- Drop previous restrictive policy if exists
DROP POLICY IF EXISTS "Users can view school details of their tenant" ON public.school_details;

-- Create more inclusive policy (Teachers, Students, Parents need to see school details like workshops?)
CREATE POLICY "Tenant members can view school details"
ON public.school_details
FOR SELECT
TO authenticated
USING (
    tenant_id IN (
        SELECT tenant_id FROM public.profile_tenants WHERE profile_id = auth.uid()
    )
    OR
    -- Allow students to view their school details
    tenant_id IN (
        SELECT tenant_id FROM public.students 
        WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
    OR
    -- Allow reading own tenant_id from profiles? 
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
);
