-- Chat docente ↔ familias, privado de verdad.
--
-- Antes:
--  * cualquier usuario de la escuela podía agregarse como participante a CUALQUIER
--    conversación y leer sus mensajes; también borrar participantes o salas ajenas;
--  * se podía escribir en salas donde uno no participa;
--  * una madre/padre podía leer el perfil completo del personal (teléfono, CURP,
--    RFC, domicilio, fecha de nacimiento).
-- Ahora:
--  * solo los participantes ven y escriben en una conversación; solo quien la creó
--    agrega participantes;
--  * las familias solo pueden abrir conversaciones con personal de la escuela
--    (no con otros padres) y ven únicamente nombre, puesto y foto del personal.

-- 1) Quién creó la sala
ALTER TABLE public.chat_rooms ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2) Salas donde participo (SECURITY DEFINER para evitar recursión en las políticas)
CREATE OR REPLACE FUNCTION public.my_chat_room_ids()
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT coalesce(array_agg(room_id), '{}'::uuid[]) FROM public.chat_participants WHERE profile_id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.my_chat_room_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_chat_room_ids() TO authenticated;

-- ¿p_profile es personal (no familia) de la escuela p_tenant?
CREATE OR REPLACE FUNCTION public.is_staff_of(p_profile uuid, p_tenant uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.profile_tenants
                  WHERE profile_id = p_profile AND tenant_id = p_tenant
                    AND upper(role) NOT IN ('TUTOR', 'STUDENT', 'GUEST', 'PENDING'));
$$;
REVOKE ALL ON FUNCTION public.is_staff_of(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff_of(uuid, uuid) TO authenticated;

-- 3) chat_rooms
DROP POLICY IF EXISTS chat_rooms_select ON public.chat_rooms;
DROP POLICY IF EXISTS chat_rooms_insert ON public.chat_rooms;
DROP POLICY IF EXISTS chat_rooms_update ON public.chat_rooms;
DROP POLICY IF EXISTS chat_rooms_delete ON public.chat_rooms;

CREATE POLICY chat_rooms_select ON public.chat_rooms FOR SELECT TO authenticated
  USING (id = ANY ((SELECT public.my_chat_room_ids())::uuid[]) OR created_by = auth.uid());
CREATE POLICY chat_rooms_insert ON public.chat_rooms FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid()
              AND EXISTS (SELECT 1 FROM public.profile_tenants pt WHERE pt.profile_id = auth.uid() AND pt.tenant_id = chat_rooms.tenant_id));
CREATE POLICY chat_rooms_update ON public.chat_rooms FOR UPDATE TO authenticated
  USING (id = ANY ((SELECT public.my_chat_room_ids())::uuid[]) OR created_by = auth.uid());
CREATE POLICY chat_rooms_delete ON public.chat_rooms FOR DELETE TO authenticated
  USING (id = ANY ((SELECT public.my_chat_room_ids())::uuid[]) OR created_by = auth.uid());

-- 4) chat_participants
DROP POLICY IF EXISTS chat_participants_select ON public.chat_participants;
DROP POLICY IF EXISTS chat_participants_insert ON public.chat_participants;
DROP POLICY IF EXISTS chat_participants_delete ON public.chat_participants;

CREATE POLICY chat_participants_select ON public.chat_participants FOR SELECT TO authenticated
  USING (profile_id = auth.uid() OR room_id = ANY ((SELECT public.my_chat_room_ids())::uuid[]));

-- Solo quien creó la sala agrega gente; el invitado debe pertenecer a esa escuela;
-- si quien crea es familia, solo puede agregarse a sí mismo o a personal.
CREATE POLICY chat_participants_insert ON public.chat_participants FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.chat_rooms r
     WHERE r.id = chat_participants.room_id
       AND r.created_by = auth.uid()
       AND EXISTS (SELECT 1 FROM public.profile_tenants pt WHERE pt.profile_id = chat_participants.profile_id AND pt.tenant_id = r.tenant_id)
       AND (chat_participants.profile_id = auth.uid()
            OR NOT coalesce(r.tenant_id = ANY ((SELECT public.family_only_tenants())::uuid[]), false)
            OR public.is_staff_of(chat_participants.profile_id, r.tenant_id))
  ));

CREATE POLICY chat_participants_delete ON public.chat_participants FOR DELETE TO authenticated
  USING (profile_id = auth.uid()
         OR EXISTS (SELECT 1 FROM public.chat_rooms r WHERE r.id = chat_participants.room_id AND r.created_by = auth.uid()));

-- 5) chat_messages: solo se escribe en salas donde uno participa
DROP POLICY IF EXISTS chat_messages_insert ON public.chat_messages;
CREATE POLICY chat_messages_insert ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND room_id = ANY ((SELECT public.my_chat_room_ids())::uuid[]));

-- 6) Nombres para el chat, sin datos personales.
--    Devuelve nombre, puesto y foto de: uno mismo, quienes comparten sala conmigo
--    y el personal de mis escuelas.
CREATE OR REPLACE FUNCTION public.chat_people(p_ids uuid[])
RETURNS TABLE (id uuid, first_name text, last_name_paternal text, last_name_maternal text, full_name text, role text, avatar_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT p.id, p.first_name, p.last_name_paternal, p.last_name_maternal, p.full_name, p.role, p.avatar_url
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

-- Personal con quien una familia puede abrir conversación (escuela actual)
CREATE OR REPLACE FUNCTION public.chat_contacts()
RETURNS TABLE (id uuid, first_name text, last_name_paternal text, last_name_maternal text, full_name text, role text, avatar_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT DISTINCT ON (p.id) p.id, coalesce(pt.first_name, p.first_name), coalesce(pt.last_name_paternal, p.last_name_paternal),
         coalesce(pt.last_name_maternal, p.last_name_maternal), p.full_name, upper(pt.role), p.avatar_url
    FROM public.profile_tenants pt
    JOIN public.profiles p ON p.id = pt.profile_id
   WHERE pt.tenant_id = public.get_current_tenant_id()
     AND auth.uid() IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.profile_tenants me WHERE me.profile_id = auth.uid() AND me.tenant_id = pt.tenant_id)
     AND upper(pt.role) NOT IN ('TUTOR', 'STUDENT', 'GUEST', 'PENDING')
     AND p.deleted_at IS NULL
     AND p.id <> auth.uid()
   ORDER BY p.id, pt.role;
$$;
REVOKE ALL ON FUNCTION public.chat_contacts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_contacts() TO authenticated;

-- 7) Las familias ya no leen filas de perfiles del personal (usan chat_people / chat_contacts)
DROP POLICY IF EXISTS familia_lectura ON public.profiles;
CREATE POLICY familia_lectura ON public.profiles AS RESTRICTIVE FOR SELECT TO authenticated
  USING (id = auth.uid()
         OR NOT coalesce(tenant_id = ANY ((SELECT public.family_only_tenants())::uuid[]), false));
