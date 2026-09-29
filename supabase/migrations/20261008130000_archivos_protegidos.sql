-- Archivos: las familias no ven documentos internos de la escuela, y nadie puede
-- listar todas las evidencias de alumnos.

-- 1) Madres/padres/alumnos no leen ni suben documentos internos (PEMC, CTE, formatos)
DROP POLICY IF EXISTS familia_archivos_internos ON storage.objects;
CREATE POLICY familia_archivos_internos ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    bucket_id NOT IN ('pemc_evidence', 'cte_documents', 'teacher_formats')
    OR NOT coalesce(public.try_uuid((storage.foldername(name))[1]) = ANY ((SELECT public.family_only_tenants())::uuid[]), false)
  )
  WITH CHECK (
    bucket_id NOT IN ('pemc_evidence', 'cte_documents', 'teacher_formats')
    OR NOT coalesce(public.try_uuid((storage.foldername(name))[1]) = ANY ((SELECT public.family_only_tenants())::uuid[]), false)
  );

-- 2) student-evidence es público por enlace (la app usa getPublicUrl); la política de
--    lectura solo servía para LISTAR todos los archivos, incluso sin sesión. Se quita.
DROP POLICY IF EXISTS "Public Access student-evidence" ON storage.objects;

-- 3) chat_attachments: cualquier usuario podía leer, subir y borrar todo. La app no usa
--    este bucket; se cierra (solo el servidor puede usarlo).
DROP POLICY IF EXISTS "Users can access chat attachments if member" ON storage.objects;
