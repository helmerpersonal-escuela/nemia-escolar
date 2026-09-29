-- Corrección de 20261008140000: para agregar participantes hay que revisar la
-- membresía del OTRO usuario, que la RLS de profile_tenants no deja ver. Se usa una
-- función SECURITY DEFINER.
CREATE OR REPLACE FUNCTION public.is_member_of(p_profile uuid, p_tenant uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.profile_tenants WHERE profile_id = p_profile AND tenant_id = p_tenant);
$$;
REVOKE ALL ON FUNCTION public.is_member_of(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_member_of(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS chat_participants_insert ON public.chat_participants;
CREATE POLICY chat_participants_insert ON public.chat_participants FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.chat_rooms r
     WHERE r.id = chat_participants.room_id
       AND r.created_by = auth.uid()
       AND public.is_member_of(chat_participants.profile_id, r.tenant_id)
       AND (chat_participants.profile_id = auth.uid()
            OR NOT coalesce(r.tenant_id = ANY ((SELECT public.family_only_tenants())::uuid[]), false)
            OR public.is_staff_of(chat_participants.profile_id, r.tenant_id))
  ));
