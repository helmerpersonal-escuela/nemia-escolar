-- Migration: Galactic Permissions (RLS Fix)
-- Description: Updates RLS policies to allow INDEPENDENT_TEACHER to manage their own data.

-- 1. Updates policies for academic_years
DROP POLICY IF EXISTS "Enable write access for admins on academic_years" ON public.academic_years;
CREATE POLICY "Enable write access for admins on academic_years" ON public.academic_years
  FOR ALL
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles 
      WHERE tenant_id = academic_years.tenant_id 
      AND role IN ('DIRECTOR', 'ADMIN', 'INDEPENDENT_TEACHER')
    )
  );

-- 2. Updates policies for evaluation_periods
DROP POLICY IF EXISTS "Enable write access for admins on evaluation_periods" ON public.evaluation_periods;
CREATE POLICY "Enable write access for admins on evaluation_periods" ON public.evaluation_periods
  FOR ALL
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles 
      WHERE tenant_id = evaluation_periods.tenant_id 
      AND role IN ('DIRECTOR', 'ADMIN', 'INDEPENDENT_TEACHER')
    )
  );

-- 3. Updates policies for analytical_programs
DROP POLICY IF EXISTS "Enable write access for admins on analytical_programs" ON public.analytical_programs;
CREATE POLICY "Enable write access for admins on analytical_programs" ON public.analytical_programs
  FOR ALL
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles 
      WHERE tenant_id = public.analytical_programs.tenant_id 
      AND role IN ('DIRECTOR', 'ADMIN', 'INDEPENDENT_TEACHER')
    )
  );

DROP POLICY IF EXISTS "Enable write access for admins on analytical_program_contents" ON public.analytical_program_contents;
CREATE POLICY "Enable write access for admins on analytical_program_contents" ON public.analytical_program_contents
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.analytical_programs p
      WHERE p.id = public.analytical_program_contents.program_id
      AND auth.uid() IN (
        SELECT id FROM public.profiles 
        WHERE tenant_id = p.tenant_id 
        AND role IN ('DIRECTOR', 'ADMIN', 'INDEPENDENT_TEACHER')
      )
    )
  );

-- 4. Updates policies for profile_subjects
DROP POLICY IF EXISTS "Enable write access for admins on profile_subjects" ON public.profile_subjects;
CREATE POLICY "Enable write access for admins on profile_subjects" ON public.profile_subjects
  FOR ALL
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles 
      WHERE tenant_id = profile_subjects.tenant_id 
      AND role IN ('DIRECTOR', 'ADMIN', 'INDEPENDENT_TEACHER')
    )
  );

-- 5. Updates policies for tenants (Settings)
DROP POLICY IF EXISTS "Enables update for tenant administrators" ON public.tenants;
CREATE POLICY "Enables update for tenant administrators" ON public.tenants
  FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles 
      WHERE tenant_id = tenants.id 
      AND role IN ('DIRECTOR', 'ADMIN', 'INDEPENDENT_TEACHER')
    )
  );

-- 6. Updates policies for subject_catalog (to allow adding custom subjects?)
-- Usually catalog is global or mixed. Let's check if there is a tenant-specific policy.
-- Assuming standard tenant isolation is enough, but if there was an explicit restrictions, we'd fix it here.
