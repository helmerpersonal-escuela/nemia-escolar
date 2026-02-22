-- FIX ALL GROUP RLS POLICIES
-- Run this in Supabase SQL Editor

-- 1. Groups Table Policies
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage groups in own tenant" ON public.groups;
DROP POLICY IF EXISTS "Admins/Teachers can manage groups" ON public.groups;
DROP POLICY IF EXISTS "Users can view groups in own tenant" ON public.groups;

CREATE POLICY "Users can manage groups in own tenant" 
ON public.groups 
FOR ALL 
USING (tenant_id = get_current_tenant_id())
WITH CHECK (tenant_id = get_current_tenant_id());

-- 2. Group Subjects Table Policies (The one failing now)
ALTER TABLE public.group_subjects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage group_subjects in own tenant" ON public.group_subjects;
DROP POLICY IF EXISTS "Admins/Teachers can manage group_subjects" ON public.group_subjects;

CREATE POLICY "Users can manage group_subjects in own tenant" 
ON public.group_subjects 
FOR ALL 
USING (tenant_id = get_current_tenant_id())
WITH CHECK (tenant_id = get_current_tenant_id());

-- 3. Academic Years (Just in case)
ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view academic_years in own tenant" ON public.academic_years;

CREATE POLICY "Users can view academic_years in own tenant" 
ON public.academic_years 
FOR SELECT 
USING (tenant_id = get_current_tenant_id());
