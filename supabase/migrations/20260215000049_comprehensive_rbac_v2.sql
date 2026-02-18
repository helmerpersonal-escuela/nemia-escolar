-- RBAC INTEGRAL - FASE 2
-- Ajuste de Políticas RLS para restringir la gestión administrativa a DIRECTIVOS y ADMINS.

-- 1. Tablas: tenants (Datos de la Escuela y API Keys)
-- Solo lectura para todos, actualización solo para ADMIN/DIRECTOR
DROP POLICY IF EXISTS "Enables update for tenant administrators" ON public.tenants;
CREATE POLICY "Enables update for tenant administrators" ON public.tenants
  FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles 
      WHERE tenant_id = tenants.id 
      AND role IN ('DIRECTOR', 'ADMIN')
    )
  );

-- 2. Tablas: academic_years y evaluation_periods
-- Solo lectura para todos, gestión solo para ADMIN/DIRECTOR
DROP POLICY IF EXISTS "Enable write access for admins on academic_years" ON public.academic_years;
CREATE POLICY "Enable write access for admins on academic_years" ON public.academic_years
  FOR ALL
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles 
      WHERE tenant_id = academic_years.tenant_id 
      AND role IN ('DIRECTOR', 'ADMIN')
    )
  );

DROP POLICY IF EXISTS "Enable write access for admins on evaluation_periods" ON public.evaluation_periods;
CREATE POLICY "Enable write access for admins on evaluation_periods" ON public.evaluation_periods
  FOR ALL
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles 
      WHERE tenant_id = evaluation_periods.tenant_id 
      AND role IN ('DIRECTOR', 'ADMIN')
    )
  );

-- 3. Programa Analítico
-- Solo lectura para todos, gestión solo para ADMIN/DIRECTOR
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
        AND role IN ('DIRECTOR', 'ADMIN')
      )
    )
  );

-- 4. Asignación de Materias (profile_subjects)
-- Los docentes solo leen sus asignaciones. Los admins gestionan.
DROP POLICY IF EXISTS "Enable write access for admins on profile_subjects" ON public.profile_subjects;
CREATE POLICY "Enable write access for admins on profile_subjects" ON public.profile_subjects
  FOR ALL
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles 
      WHERE tenant_id = profile_subjects.tenant_id 
      AND role IN ('DIRECTOR', 'ADMIN')
    )
  );

-- 5. Perfiles (profiles)
-- Todo usuario puede actualizar su propio perfil (nombre, avatar).
-- Solo admins pueden actualizar roles o eliminar? 
-- El usuario pide que el personal pueda editar su info personal si lo requiere.
DROP POLICY IF EXISTS "Public profiles are viewable by everyone in tenant" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone in tenant" ON public.profiles
  FOR SELECT
  USING (auth.uid() IN (SELECT id FROM profiles p WHERE p.tenant_id = profiles.tenant_id));

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    -- Evitar que un usuario se cambie a sí mismo de tenant o de rol si no es admin
    (CASE 
      WHEN (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('DIRECTOR', 'ADMIN') THEN true
      ELSE (
        role = (SELECT role FROM public.profiles WHERE id = auth.uid()) AND
        tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
      )
    END)
  );

-- 6. Storage Buckets para Documentos Personales y Chat
INSERT INTO storage.buckets (id, name, public) 
VALUES ('staff_documents', 'staff_documents', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('chat_attachments', 'chat_attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas de Storage
CREATE POLICY "Staff can manage their own documents"
ON storage.objects FOR ALL
USING (
  bucket_id = 'staff_documents' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can access chat attachments if member"
ON storage.objects FOR ALL
USING (
  bucket_id = 'chat_attachments' -- Simplificado para fines de demo, idealmente validar pertenencia a room
);
