-- 1) school_details: la política de escritura no validaba la escuela: cualquier
--    director/admin/docente independiente podía modificar los datos de CUALQUIER escuela.
DROP POLICY IF EXISTS "Admins and Independent Teachers can manage school details" ON public.school_details;
DROP POLICY IF EXISTS "School managers manage own school details" ON public.school_details;
CREATE POLICY "School managers manage own school details" ON public.school_details
    FOR ALL TO authenticated
    USING (
        public.is_god_mode()
        OR coalesce(public.my_role_in_tenant(tenant_id), '') IN ('DIRECTOR', 'ADMIN', 'INDEPENDENT_TEACHER')
        OR EXISTS (SELECT 1 FROM public.profiles p
                   WHERE p.id = auth.uid() AND p.tenant_id = school_details.tenant_id
                     AND p.role IN ('DIRECTOR', 'ADMIN', 'INDEPENDENT_TEACHER'))
    )
    WITH CHECK (
        public.is_god_mode()
        OR coalesce(public.my_role_in_tenant(tenant_id), '') IN ('DIRECTOR', 'ADMIN', 'INDEPENDENT_TEACHER')
        OR EXISTS (SELECT 1 FROM public.profiles p
                   WHERE p.id = auth.uid() AND p.tenant_id = school_details.tenant_id
                     AND p.role IN ('DIRECTOR', 'ADMIN', 'INDEPENDENT_TEACHER'))
    );

DROP POLICY IF EXISTS "Members view school details" ON public.school_details;
CREATE POLICY "Members view school details" ON public.school_details
    FOR SELECT TO authenticated
    USING (public.is_tenant_member(tenant_id));

-- 2) Personal de la escuela (para asignar responsables de acuerdos del CTE)
CREATE OR REPLACE FUNCTION public.tenant_staff(p_tenant uuid)
RETURNS TABLE (profile_id uuid, name text, role text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT pt.profile_id,
           nullif(trim(concat_ws(' ', pt.first_name, pt.last_name_paternal, pt.last_name_maternal)), '') AS name,
           upper(pt.role) AS role
    FROM public.profile_tenants pt
    WHERE pt.tenant_id = p_tenant
      AND upper(pt.role) NOT IN ('STUDENT', 'TUTOR')
      AND public.is_cte_manager(p_tenant)
    ORDER BY 2 NULLS LAST;
$$;
REVOKE ALL ON FUNCTION public.tenant_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tenant_staff(uuid) TO authenticated;

-- 3) Publicar la agenda del CTE para el colectivo docente
-- Devuelve false si la escuela aún no tiene sus datos generales capturados (Ajustes).
CREATE OR REPLACE FUNCTION public.cte_publish_agenda(p_tenant uuid, p_agenda jsonb, p_session uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_session public.cte_sessions%ROWTYPE;
    v_patch   jsonb;
BEGIN
    IF NOT public.is_cte_manager(p_tenant) THEN
        RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
    END IF;
    IF jsonb_typeof(coalesce(p_agenda, '[]'::jsonb)) <> 'array' THEN
        RAISE EXCEPTION 'Agenda inválida';
    END IF;

    v_patch := jsonb_build_object('agenda', coalesce(p_agenda, '[]'::jsonb), 'published_at', now());

    IF p_session IS NOT NULL THEN
        SELECT * INTO v_session FROM public.cte_sessions WHERE id = p_session AND tenant_id = p_tenant;
        IF NOT FOUND THEN RAISE EXCEPTION 'Sesión no encontrada'; END IF;
        UPDATE public.cte_sessions SET agenda = coalesce(p_agenda, '[]'::jsonb), status = 'AGENDA_READY'
         WHERE id = p_session AND status <> 'DONE';
        v_patch := v_patch || jsonb_build_object(
            'next_date', v_session.date,
            'session_id', v_session.id,
            'session_label', coalesce(v_session.title, v_session.session_number || 'ª sesión ordinaria'));
    END IF;

    UPDATE public.school_details
       SET cte_config = coalesce(cte_config, '{}'::jsonb) || v_patch,
           updated_at = now()
     WHERE tenant_id = p_tenant;
    RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.cte_publish_agenda(uuid, jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cte_publish_agenda(uuid, jsonb, uuid) TO authenticated;
