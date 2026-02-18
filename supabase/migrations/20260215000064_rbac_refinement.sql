-- REFINAMIENTO DE RBAC: PROGRAMA ANALÍTICO Y CALENDARIO
-- Este script ajusta las políticas RLS para asegurar que los docentes solo tengan acceso de lectura
-- y que la gestión oficial sea exclusiva de DIRECTORES y ADMINS.

-- 1. Programa Analítico (analytical_programs)
DROP POLICY IF EXISTS "Enable read access for members of same tenant" ON public.analytical_programs;
CREATE POLICY "Enable read access for members of same tenant" ON public.analytical_programs
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles 
      WHERE tenant_id = analytical_programs.tenant_id
    )
  );

DROP POLICY IF EXISTS "Enable write access for admins on analytical_programs" ON public.analytical_programs;
CREATE POLICY "Enable write access for admins on analytical_programs" ON public.analytical_programs
  FOR ALL
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles 
      WHERE tenant_id = public.analytical_programs.tenant_id 
      AND role IN ('DIRECTOR', 'ADMIN')
    )
  );

-- 2. Calendario Oficial (calendar_events)
DROP POLICY IF EXISTS "Enable read access for all users" ON public.calendar_events;
CREATE POLICY "Enable read access for all users" ON public.calendar_events 
  FOR SELECT 
  USING (true);

DROP POLICY IF EXISTS "Enable manage for admins only" ON public.calendar_events;
CREATE POLICY "Enable manage for admins only" ON public.calendar_events
  FOR ALL
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles 
      WHERE tenant_id = public.calendar_events.tenant_id 
      AND role IN ('DIRECTOR', 'ADMIN')
    )
  );

-- 3. Calendario Personal (teacher_events)
DROP POLICY IF EXISTS "Teachers can manage their own events" ON public.teacher_events;
CREATE POLICY "Teachers can manage their own events" ON public.teacher_events 
  FOR ALL
  USING (auth.uid() = teacher_id);
