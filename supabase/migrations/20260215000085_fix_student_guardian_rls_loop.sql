-- Fix Recursive RLS Loop in Students/Guardians
-- The "Guardians can view their students" policy creates an infinite loop

-- Add tenant_id to guardians table to avoid recursive queries
ALTER TABLE public.guardians ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);

-- Backfill tenant_id for existing guardians
UPDATE public.guardians 
SET tenant_id = (SELECT tenant_id FROM public.students WHERE students.id = guardians.student_id)
WHERE tenant_id IS NULL;

-- Drop old policies
DROP POLICY IF EXISTS "Users can view guardians in own tenant" ON public.guardians;
DROP POLICY IF EXISTS "Admins/Teachers can manage guardians" ON public.guardians;

-- Recreate with simple tenant_id check (no recursion)
CREATE POLICY "Users can view guardians in own tenant" ON public.guardians 
FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "Admins/Teachers can manage guardians" ON public.guardians 
FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
);
