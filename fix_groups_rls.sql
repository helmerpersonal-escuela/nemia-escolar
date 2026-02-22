-- FIX GROUPS RLS POLICY
-- Run this in Supabase SQL Editor

-- 1. Ensure helper function exists and is correct
CREATE OR REPLACE FUNCTION get_current_tenant_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT tenant_id FROM public.profiles WHERE id = auth.uid();
$$;

-- 2. Reset Policies for Groups Table
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

-- Drop potentially conflicting or old named policies
DROP POLICY IF EXISTS "Admins/Teachers can manage groups" ON public.groups;
DROP POLICY IF EXISTS "Users can view groups in own tenant" ON public.groups;
DROP POLICY IF EXISTS "Users can manage groups in own tenant" ON public.groups;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.groups;

-- Create a SINGLE, comprehensive policy for Tenant isolation
CREATE POLICY "Users can manage groups in own tenant" 
ON public.groups 
FOR ALL 
USING (tenant_id = get_current_tenant_id())
WITH CHECK (tenant_id = get_current_tenant_id());

-- 3. Verify Academic Years Access (often related)
ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view academic_years in own tenant" ON public.academic_years;

CREATE POLICY "Users can view academic_years in own tenant" 
ON public.academic_years 
FOR SELECT 
USING (tenant_id = get_current_tenant_id());
