-- Add teacher_id to group_subjects
ALTER TABLE public.group_subjects ADD COLUMN IF NOT EXISTS teacher_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Initial data cleanup: if teacher_id is null, it means it's unassigned or for admin view
-- Usually in this system, the creator of the group_subject was the teacher (CJS mode)
-- But moving forward, it's explicitly assigned.

-- Update RLS Policies for group_subjects
-- Users can view group_subjects in their tenant if:
-- 1. They are ADMIN, DIRECTIVO, COORDINACION, etc. (Staff roles)
-- 2. They are the assigned TEACHER for that subject.

DROP POLICY IF EXISTS "Users can view group_subjects in own tenant" ON public.group_subjects;
DROP POLICY IF EXISTS "Admins/Teachers can manage group_subjects" ON public.group_subjects;

-- Policy for viewing:
-- Admins/Staff see all group subjects in their tenant.
-- Teachers see only those assigned to them.
DROP POLICY IF EXISTS "Staff can view all group subjects" ON public.group_subjects;
CREATE POLICY "Staff can view all group subjects" ON public.group_subjects
    FOR SELECT USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('ADMIN', 'DIRECTOR', 'ACADEMIC_COORD', 'TECH_COORD', 'SCHOOL_CONTROL')
        AND tenant_id = get_current_tenant_id()
    );

DROP POLICY IF EXISTS "Teachers can view assigned group subjects" ON public.group_subjects;
CREATE POLICY "Teachers can view assigned group subjects" ON public.group_subjects
    FOR SELECT USING (
        teacher_id = auth.uid()
        AND tenant_id = get_current_tenant_id()
    );

-- Policy for Management:
-- Only certain roles can manage group subjects.
DROP POLICY IF EXISTS "Admins can manage group subjects" ON public.group_subjects;
CREATE POLICY "Admins can manage group subjects" ON public.group_subjects
    FOR ALL USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('ADMIN', 'DIRECTOR', 'ACADEMIC_COORD', 'TECH_COORD', 'SCHOOL_CONTROL')
        AND tenant_id = get_current_tenant_id()
    );

-- Update RLS for public.groups as well
DROP POLICY IF EXISTS "Users can view groups in own tenant" ON public.groups;
DROP POLICY IF EXISTS "Admins/Teachers can manage groups" ON public.groups;

DROP POLICY IF EXISTS "Staff can view all groups" ON public.groups;
CREATE POLICY "Staff can view all groups" ON public.groups
    FOR SELECT USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('ADMIN', 'DIRECTOR', 'ACADEMIC_COORD', 'TECH_COORD', 'SCHOOL_CONTROL')
        AND tenant_id = get_current_tenant_id()
    );

DROP POLICY IF EXISTS "Teachers can view assigned groups" ON public.groups;
CREATE POLICY "Teachers can view assigned groups" ON public.groups
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.group_subjects
            WHERE group_id = public.groups.id
            AND teacher_id = auth.uid()
        )
        AND tenant_id = get_current_tenant_id()
    );

DROP POLICY IF EXISTS "Staff can manage groups" ON public.groups;
CREATE POLICY "Staff can manage groups" ON public.groups
    FOR ALL USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('ADMIN', 'DIRECTOR', 'ACADEMIC_COORD', 'TECH_COORD', 'SCHOOL_CONTROL')
        AND tenant_id = get_current_tenant_id()
    );
