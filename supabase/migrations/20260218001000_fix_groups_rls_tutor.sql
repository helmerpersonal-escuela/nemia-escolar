-- FIX: Allow Tutors and Students to view Group details
-- The current policies only allow Staff and Teachers to see groups.
-- Run in Supabase SQL Editor

-- Add policy for SELECT on groups table
DROP POLICY IF EXISTS "Users can view groups in their tenant" ON public.groups;
CREATE POLICY "Users can view groups in their tenant" ON public.groups
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.tenant_id = groups.tenant_id
    )
);

-- Verify the policy was added
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'groups' AND policyname = 'Users can view groups in their tenant';
