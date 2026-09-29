-- Acceso de familias (TUTOR) y alumnos (STUDENT): solo lectura de lo propio.
--
-- Antes: un padre quedaba como miembro de la escuela y las políticas por escuela
-- le daban lectura y escritura sobre todos los alumnos, calificaciones y asistencias.
-- Ahora se agregan políticas RESTRICTIVAS: se suman (AND) a las existentes y solo
-- afectan a quien en esa escuela es únicamente padre/alumno. El personal no cambia.

-- 1) Escuelas donde el usuario es SOLO familia/alumno (sin ningún puesto de personal)
CREATE OR REPLACE FUNCTION public.family_only_tenants()
RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT coalesce(array_agg(DISTINCT f.t), '{}'::uuid[])
  FROM (
    SELECT pt.tenant_id AS t FROM public.profile_tenants pt
     WHERE pt.profile_id = auth.uid() AND upper(pt.role) IN ('TUTOR', 'STUDENT')
    UNION
    SELECT p.tenant_id FROM public.profiles p
     WHERE p.id = auth.uid() AND upper(p.role) IN ('TUTOR', 'STUDENT') AND p.tenant_id IS NOT NULL
  ) f
  WHERE auth.uid() IS NOT NULL
    AND NOT public.is_god_mode()
    AND NOT EXISTS (
      SELECT 1 FROM public.profile_tenants s
       WHERE s.profile_id = auth.uid() AND s.tenant_id = f.t
         AND upper(s.role) NOT IN ('TUTOR', 'STUDENT', 'GUEST', 'PENDING'));
$$;

-- 2) Alumnos ligados al usuario (sus hijos, o él mismo si es alumno)
CREATE OR REPLACE FUNCTION public.my_student_ids()
RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT coalesce(array_agg(DISTINCT s), '{}'::uuid[])
  FROM (
    SELECT g.student_id AS s FROM public.guardians g
     WHERE g.student_id IS NOT NULL AND (g.user_id = auth.uid() OR g.profile_id = auth.uid())
    UNION
    SELECT st.id FROM public.students st WHERE st.user_id = auth.uid()
  ) x
  WHERE auth.uid() IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.family_only_tenants() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_student_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.family_only_tenants() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_student_ids() TO authenticated;

-- 3) Políticas restrictivas
DO $$
DECLARE
  fam  constant text := 'coalesce(tenant_id = ANY ((SELECT public.family_only_tenants())::uuid[]), false)';
  kids constant text := '(SELECT public.my_student_ids())::uuid[]';
  t text;
  -- Lectura solo de registros de sus hijos
  child_tables text[] := ARRAY['attendance', 'grades', 'student_incidents', 'evaluation_snapshots',
                               'student_citations', 'evidence_portfolio', 'student_enrollments'];
  -- Lectura de datos generales de la escuela (calendario, grupos, avisos...)
  school_tables text[] := ARRAY['academic_years', 'evaluation_periods', 'groups', 'group_subjects',
                                'assignments', 'school_announcements', 'calendar_events', 'school_details',
                                'schedule_settings', 'schedules', 'special_schedule_structure'];
  -- Tablas que se manejan aparte (propias reglas o más abajo)
  skip_tables text[] := ARRAY['students', 'guardians', 'profiles', 'profile_tenants',
                              'chat_rooms', 'chat_permissions', 'client_errors'];
BEGIN
  FOR t IN
    SELECT c.table_name FROM information_schema.columns c
      JOIN information_schema.tables tb ON tb.table_schema = c.table_schema AND tb.table_name = c.table_name
     WHERE c.table_schema = 'public' AND c.column_name = 'tenant_id' AND tb.table_type = 'BASE TABLE'
  LOOP
    IF t = ANY (skip_tables) THEN CONTINUE; END IF;

    EXECUTE format('DROP POLICY IF EXISTS familia_lectura ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS familia_alta ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS familia_cambio ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS familia_baja ON public.%I', t);

    IF t = ANY (child_tables) THEN
      EXECUTE format('CREATE POLICY familia_lectura ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated USING (NOT %s OR student_id = ANY (%s))', t, fam, kids);
    ELSIF t = ANY (school_tables) THEN
      -- sin restricción extra de lectura
      NULL;
    ELSE
      EXECUTE format('CREATE POLICY familia_lectura ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated USING (NOT %s)', t, fam);
    END IF;

    EXECUTE format('CREATE POLICY familia_alta ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT %s)', t, fam);
    EXECUTE format('CREATE POLICY familia_cambio ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (NOT %s)', t, fam);
    EXECUTE format('CREATE POLICY familia_baja ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (NOT %s)', t, fam);
  END LOOP;
END $$;

-- students: solo sus hijos; sin escritura
DROP POLICY IF EXISTS familia_lectura ON public.students;
DROP POLICY IF EXISTS familia_escritura ON public.students;
CREATE POLICY familia_lectura ON public.students AS RESTRICTIVE FOR SELECT TO authenticated
  USING (NOT coalesce(tenant_id = ANY ((SELECT public.family_only_tenants())::uuid[]), false) OR id = ANY ((SELECT public.my_student_ids())::uuid[]));
CREATE POLICY familia_escritura ON public.students AS RESTRICTIVE FOR ALL TO authenticated
  USING (NOT coalesce(tenant_id = ANY ((SELECT public.family_only_tenants())::uuid[]), false) OR id = ANY ((SELECT public.my_student_ids())::uuid[]))
  WITH CHECK (NOT coalesce(tenant_id = ANY ((SELECT public.family_only_tenants())::uuid[]), false));

-- guardians: solo su propio registro; sin escritura
DROP POLICY IF EXISTS familia_lectura ON public.guardians;
DROP POLICY IF EXISTS familia_escritura ON public.guardians;
CREATE POLICY familia_lectura ON public.guardians AS RESTRICTIVE FOR SELECT TO authenticated
  USING (NOT coalesce(tenant_id = ANY ((SELECT public.family_only_tenants())::uuid[]), false)
         OR user_id = auth.uid() OR profile_id = auth.uid());
CREATE POLICY familia_escritura ON public.guardians AS RESTRICTIVE FOR ALL TO authenticated
  USING (NOT coalesce(tenant_id = ANY ((SELECT public.family_only_tenants())::uuid[]), false)
         OR user_id = auth.uid() OR profile_id = auth.uid())
  WITH CHECK (NOT coalesce(tenant_id = ANY ((SELECT public.family_only_tenants())::uuid[]), false));

-- profiles: la familia ve su perfil y al personal, no a otros padres ni alumnos
DROP POLICY IF EXISTS familia_lectura ON public.profiles;
CREATE POLICY familia_lectura ON public.profiles AS RESTRICTIVE FOR SELECT TO authenticated
  USING (id = auth.uid()
         OR NOT coalesce(tenant_id = ANY ((SELECT public.family_only_tenants())::uuid[]), false)
         OR upper(coalesce(role, '')) NOT IN ('TUTOR', 'STUDENT', 'PENDING'));

-- profile_tenants: sus propios vínculos y los del personal
DROP POLICY IF EXISTS familia_lectura ON public.profile_tenants;
CREATE POLICY familia_lectura ON public.profile_tenants AS RESTRICTIVE FOR SELECT TO authenticated
  USING (profile_id = auth.uid()
         OR NOT coalesce(tenant_id = ANY ((SELECT public.family_only_tenants())::uuid[]), false)
         OR upper(role) NOT IN ('TUTOR', 'STUDENT'));

-- 4) Vínculo padre-hijo: la app lee guardians.user_id; la invitación llenaba profile_id.
CREATE OR REPLACE FUNCTION public.guardians_sync_account()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.user_id IS NULL AND NEW.profile_id IS NOT NULL THEN NEW.user_id := NEW.profile_id; END IF;
  IF NEW.profile_id IS NULL AND NEW.user_id IS NOT NULL THEN NEW.profile_id := NEW.user_id; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS guardians_sync_account ON public.guardians;
CREATE TRIGGER guardians_sync_account BEFORE INSERT OR UPDATE ON public.guardians
  FOR EACH ROW EXECUTE FUNCTION public.guardians_sync_account();

UPDATE public.guardians SET user_id = profile_id WHERE user_id IS NULL AND profile_id IS NOT NULL;
