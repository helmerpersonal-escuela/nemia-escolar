-- Chat: adjuntos privados (fotos, PDF, notas de voz), "leído" y nombres que dicen
-- quién escribe: "Profra. Daniela López · Tecnología" o "Mamá de Helmer · 1° C".

-- 1) Tipo de mensaje para notas de voz
ALTER TABLE public.chat_messages DROP CONSTRAINT IF EXISTS chat_messages_type_check;
ALTER TABLE public.chat_messages ADD CONSTRAINT chat_messages_type_check CHECK (type = ANY (ARRAY[
  'TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT', 'AUDIO', 'REPORT', 'STICKER', 'FILE', 'SYSTEM', 'NOTIFICATION', 'WELCOME']));

-- 2) Archivos del chat: bucket privado, una carpeta por conversación.
--    Solo los participantes de la conversación suben o abren sus archivos.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('chat_files', 'chat_files', false, 15728640,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
              'application/pdf',
              'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/aac', 'audio/x-m4a', 'audio/wav'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Chat files: participantes leen" ON storage.objects;
DROP POLICY IF EXISTS "Chat files: participantes suben" ON storage.objects;
DROP POLICY IF EXISTS "Chat files: autor borra" ON storage.objects;
CREATE POLICY "Chat files: participantes leen" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chat_files'
         AND public.try_uuid((storage.foldername(name))[1]) = ANY (public.my_chat_room_ids()));
CREATE POLICY "Chat files: participantes suben" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat_files'
              AND public.try_uuid((storage.foldername(name))[1]) = ANY (public.my_chat_room_ids()));
CREATE POLICY "Chat files: autor borra" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'chat_files' AND owner = auth.uid());

-- 3) Marcar como leído (chat_participants no tiene política de UPDATE)
CREATE OR REPLACE FUNCTION public.mark_chat_read(p_room uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  UPDATE public.chat_participants SET last_read_at = now()
   WHERE room_id = p_room AND profile_id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.mark_chat_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_chat_read(uuid) TO authenticated;

-- 4) Cómo se presenta una persona ante quien consulta (auth.uid())
CREATE OR REPLACE FUNCTION public.chat_label(p_person uuid, p_tenant uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_viewer uuid := auth.uid();
  v_role text;
  v_first text; v_last text; v_name text;
  v_sex text;
  v_subjects text;
  v_rel text; v_child text; v_group text; v_more int;
BEGIN
  SELECT initcap(split_part(trim(coalesce(pt.first_name, p.first_name, '')), ' ', 1)),
         initcap(trim(coalesce(pt.last_name_paternal, p.last_name_paternal, ''))),
         upper(coalesce(pt.role, p.role))
    INTO v_first, v_last, v_role
    FROM public.profiles p
    LEFT JOIN public.profile_tenants pt ON pt.profile_id = p.id AND pt.tenant_id = p_tenant
   WHERE p.id = p_person
   ORDER BY (upper(pt.role) IN ('TUTOR', 'STUDENT'))  -- si tiene puesto de personal, ese primero
   LIMIT 1;
  v_name := nullif(trim(concat_ws(' ', v_first, v_last)), '');

  -- Madre, padre o tutor: "Mamá de Helmer · 1° C"
  IF v_role IN ('TUTOR', 'STUDENT') THEN
    SELECT CASE upper(coalesce(g.relationship, ''))
             WHEN 'MADRE' THEN 'Mamá de' WHEN 'PADRE' THEN 'Papá de'
             WHEN 'ABUELO(A)' THEN 'Abuelo(a) de' ELSE 'Tutor(a) de' END,
           initcap(split_part(trim(s.first_name), ' ', 1)) || ' ' || initcap(coalesce(s.last_name_paternal, '')),
           CASE WHEN gr.id IS NOT NULL THEN gr.grade || '° ' || gr.section END
      INTO v_rel, v_child, v_group
      FROM public.guardians g
      JOIN public.students s ON s.id = g.student_id
      LEFT JOIN public.groups gr ON gr.id = s.group_id
     WHERE (g.user_id = p_person OR g.profile_id = p_person) AND g.tenant_id = p_tenant
     ORDER BY EXISTS (SELECT 1 FROM public.group_subjects gs WHERE gs.group_id = s.group_id AND gs.teacher_id = v_viewer) DESC,
              s.first_name
     LIMIT 1;
    IF v_child IS NOT NULL THEN
      SELECT count(DISTINCT g.student_id) - 1 INTO v_more FROM public.guardians g
       WHERE (g.user_id = p_person OR g.profile_id = p_person) AND g.tenant_id = p_tenant;
      RETURN v_rel || ' ' || trim(v_child)
             || CASE WHEN v_more > 0 THEN ' y ' || v_more || ' más' ELSE '' END
             || coalesce(' · ' || v_group, '');
    END IF;
    IF v_role = 'STUDENT' THEN RETURN coalesce('Alumno(a) ' || v_name, 'Alumno(a)'); END IF;
    RETURN coalesce('Tutor(a): ' || v_name, 'Madre, padre o tutor');
  END IF;

  -- Docente: "Profra. Daniela López · Tecnología"
  IF v_role IN ('TEACHER', 'INDEPENDENT_TEACHER') THEN
    SELECT upper(sex) INTO v_sex FROM public.profile_private WHERE profile_id = p_person;
    -- Materias que da a los hijos de quien consulta; si no aplica, todas las que da en la escuela
    SELECT string_agg(DISTINCT initcap(coalesce(gs.custom_name, sc.name)), ', ')
      INTO v_subjects
      FROM public.group_subjects gs
      LEFT JOIN public.subject_catalog sc ON sc.id = gs.subject_catalog_id
     WHERE gs.teacher_id = p_person AND gs.tenant_id = p_tenant
       AND gs.group_id IN (SELECT s.group_id FROM public.students s WHERE s.id = ANY (public.my_student_ids()));
    IF v_subjects IS NULL THEN
      SELECT string_agg(DISTINCT initcap(coalesce(gs.custom_name, sc.name)), ', ')
        INTO v_subjects
        FROM public.group_subjects gs
        LEFT JOIN public.subject_catalog sc ON sc.id = gs.subject_catalog_id
       WHERE gs.teacher_id = p_person AND gs.tenant_id = p_tenant;
    END IF;
    RETURN CASE v_sex WHEN 'MUJER' THEN 'Profra. ' WHEN 'HOMBRE' THEN 'Profr. ' ELSE 'Docente ' END
           || coalesce(v_name, '') || coalesce(' · ' || v_subjects, '');
  END IF;

  RETURN CASE v_role
           WHEN 'DIRECTOR' THEN 'Dirección'
           WHEN 'ADMIN' THEN 'Administración'
           WHEN 'ACADEMIC_COORD' THEN 'Coordinación académica'
           WHEN 'TECH_COORD' THEN 'Coordinación de tecnologías'
           WHEN 'SCHOOL_CONTROL' THEN 'Control escolar'
           WHEN 'PREFECT' THEN 'Prefectura'
           WHEN 'SUPPORT' THEN 'Apoyo / USAER'
           WHEN 'SOCIAL_WORKER' THEN 'Trabajo social'
           ELSE NULL END
         || CASE WHEN v_role IN ('DIRECTOR', 'ADMIN', 'ACADEMIC_COORD', 'TECH_COORD', 'SCHOOL_CONTROL', 'PREFECT', 'SUPPORT', 'SOCIAL_WORKER')
                 THEN coalesce(' · ' || v_name, '') ELSE coalesce(v_name, 'Usuario') END;
END $$;
REVOKE ALL ON FUNCTION public.chat_label(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_label(uuid, uuid) TO authenticated;

-- 5) chat_people ahora incluye la etiqueta
DROP FUNCTION IF EXISTS public.chat_people(uuid[]);
CREATE FUNCTION public.chat_people(p_ids uuid[])
RETURNS TABLE (id uuid, first_name text, last_name_paternal text, last_name_maternal text, full_name text, role text, avatar_url text, label text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT p.id, p.first_name, p.last_name_paternal, p.last_name_maternal, p.full_name, p.role, p.avatar_url,
         public.chat_label(p.id, coalesce(
           (SELECT r.tenant_id FROM public.chat_participants a JOIN public.chat_participants b ON a.room_id = b.room_id
              JOIN public.chat_rooms r ON r.id = a.room_id
             WHERE a.profile_id = auth.uid() AND b.profile_id = p.id LIMIT 1),
           public.get_current_tenant_id()))
    FROM public.profiles p
   WHERE p.id = ANY (p_ids)
     AND auth.uid() IS NOT NULL
     AND (
       p.id = auth.uid()
       OR EXISTS (SELECT 1 FROM public.chat_participants a JOIN public.chat_participants b ON a.room_id = b.room_id
                   WHERE a.profile_id = auth.uid() AND b.profile_id = p.id)
       OR EXISTS (SELECT 1 FROM public.profile_tenants mine JOIN public.profile_tenants theirs ON mine.tenant_id = theirs.tenant_id
                   WHERE mine.profile_id = auth.uid() AND theirs.profile_id = p.id
                     AND upper(theirs.role) NOT IN ('TUTOR', 'STUDENT', 'GUEST', 'PENDING'))
     );
$$;
REVOKE ALL ON FUNCTION public.chat_people(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_people(uuid[]) TO authenticated;

-- chat_contacts con etiqueta (para el selector "Nueva conversación")
DROP FUNCTION IF EXISTS public.chat_contacts();
CREATE FUNCTION public.chat_contacts()
RETURNS TABLE (id uuid, first_name text, last_name_paternal text, last_name_maternal text, full_name text, role text, avatar_url text, label text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT x.*, public.chat_label(x.id, public.get_current_tenant_id()) FROM (
    SELECT DISTINCT ON (p.id) p.id, coalesce(pt.first_name, p.first_name) AS first_name,
           coalesce(pt.last_name_paternal, p.last_name_paternal) AS last_name_paternal,
           coalesce(pt.last_name_maternal, p.last_name_maternal) AS last_name_maternal,
           p.full_name, upper(pt.role) AS role, p.avatar_url
      FROM public.profile_tenants pt
      JOIN public.profiles p ON p.id = pt.profile_id
     WHERE pt.tenant_id = public.get_current_tenant_id()
       AND auth.uid() IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.profile_tenants me WHERE me.profile_id = auth.uid() AND me.tenant_id = pt.tenant_id)
       AND upper(pt.role) NOT IN ('TUTOR', 'STUDENT', 'GUEST', 'PENDING')
       AND p.deleted_at IS NULL
       AND p.id <> auth.uid()
     ORDER BY p.id, pt.role
  ) x;
$$;
REVOKE ALL ON FUNCTION public.chat_contacts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_contacts() TO authenticated;

-- 6) Conversaciones con mensajes sin leer (para la campana de notificaciones)
CREATE OR REPLACE FUNCTION public.my_unread_chats()
RETURNS TABLE (room_id uuid, room_name text, room_type text, unread int, last_at timestamptz,
               sender_id uuid, sender_label text, preview text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT cp.room_id, r.name, r.type, u.n, lm.created_at, lm.sender_id,
         CASE WHEN lm.sender_id IS NULL THEN coalesce(r.name, 'Vunlek') ELSE public.chat_label(lm.sender_id, r.tenant_id) END,
         CASE lm.type
           WHEN 'IMAGE' THEN 'Foto'
           WHEN 'AUDIO' THEN 'Nota de voz'
           WHEN 'DOCUMENT' THEN 'Documento' || coalesce(': ' || (lm.metadata->>'name'), '')
           ELSE left(lm.content, 90) END
    FROM public.chat_participants cp
    JOIN public.chat_rooms r ON r.id = cp.room_id
    CROSS JOIN LATERAL (
      SELECT count(*)::int AS n FROM public.chat_messages m
       WHERE m.room_id = cp.room_id AND m.created_at > coalesce(cp.last_read_at, 'epoch')
         AND m.sender_id IS DISTINCT FROM auth.uid()) u
    CROSS JOIN LATERAL (
      SELECT m.* FROM public.chat_messages m
       WHERE m.room_id = cp.room_id AND m.sender_id IS DISTINCT FROM auth.uid()
       ORDER BY m.created_at DESC LIMIT 1) lm
   WHERE cp.profile_id = auth.uid() AND u.n > 0
   ORDER BY lm.created_at DESC
   LIMIT 20;
$$;
REVOKE ALL ON FUNCTION public.my_unread_chats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_unread_chats() TO authenticated;
