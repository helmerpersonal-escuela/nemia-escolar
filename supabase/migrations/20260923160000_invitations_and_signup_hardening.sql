-- =====================================================================
-- Invitaciones y registro de usuarios — 23/09/2026
--
-- Problema: la política de staff_invitations dejaba a CUALQUIER miembro
-- de una escuela (docente, tutor, alumno) crear invitaciones con
-- cualquier rol, incluido DIRECTOR. Con esa invitación se registraba una
-- cuenta nueva como Director de la escuela.
-- Además handle_new_user no verificaba que el correo coincidiera con la
-- invitación ni limitaba el rol.
-- =====================================================================

-- Rol del usuario actual en una escuela (según profile_tenants)
CREATE OR REPLACE FUNCTION public.my_role_in_tenant(p_tenant uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT upper(role) FROM public.profile_tenants
    WHERE profile_id = auth.uid() AND tenant_id = p_tenant
    LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.my_role_in_tenant(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_role_in_tenant(uuid) TO authenticated, service_role;

-- ---------- Políticas de staff_invitations ----------
DROP POLICY IF EXISTS "Admins can manage invitations in their tenant" ON public.staff_invitations;
DROP POLICY IF EXISTS "Managers read invitations" ON public.staff_invitations;
DROP POLICY IF EXISTS "Managers create invitations" ON public.staff_invitations;
DROP POLICY IF EXISTS "Managers update invitations" ON public.staff_invitations;
DROP POLICY IF EXISTS "Managers delete invitations" ON public.staff_invitations;

CREATE POLICY "Managers read invitations" ON public.staff_invitations
FOR SELECT USING (
    public.is_god_mode()
    OR public.my_role_in_tenant(tenant_id) IN ('DIRECTOR', 'ADMIN', 'ACADEMIC_COORD', 'TECH_COORD')
);

-- Crear: Dirección/Coordinación de ESA escuela. Solo Dirección/Admin
-- puede invitar a Dirección/Admin. Nadie invita SUPER_ADMIN.
CREATE POLICY "Managers create invitations" ON public.staff_invitations
FOR INSERT WITH CHECK (
    upper(role) <> 'SUPER_ADMIN'
    AND (
        public.is_god_mode()
        OR (
            public.my_role_in_tenant(tenant_id) IN ('DIRECTOR', 'ADMIN', 'ACADEMIC_COORD', 'TECH_COORD')
            AND (upper(role) NOT IN ('DIRECTOR', 'ADMIN')
                 OR public.my_role_in_tenant(tenant_id) IN ('DIRECTOR', 'ADMIN'))
        )
    )
);

CREATE POLICY "Managers update invitations" ON public.staff_invitations
FOR UPDATE USING (
    public.is_god_mode()
    OR public.my_role_in_tenant(tenant_id) IN ('DIRECTOR', 'ADMIN', 'ACADEMIC_COORD', 'TECH_COORD')
) WITH CHECK (
    upper(role) <> 'SUPER_ADMIN'
    AND (
        public.is_god_mode()
        OR (
            public.my_role_in_tenant(tenant_id) IN ('DIRECTOR', 'ADMIN', 'ACADEMIC_COORD', 'TECH_COORD')
            AND (upper(role) NOT IN ('DIRECTOR', 'ADMIN')
                 OR public.my_role_in_tenant(tenant_id) IN ('DIRECTOR', 'ADMIN'))
        )
    )
);

CREATE POLICY "Managers delete invitations" ON public.staff_invitations
FOR DELETE USING (
    public.is_god_mode()
    OR public.my_role_in_tenant(tenant_id) IN ('DIRECTOR', 'ADMIN', 'ACADEMIC_COORD', 'TECH_COORD')
);

REVOKE ALL ON public.staff_invitations FROM anon;

-- ---------- Registro de usuarios ----------
-- Igual que la versión en producción, más:
--   * la invitación solo se usa si el correo coincide,
--   * el rol de la invitación debe estar en la lista permitida,
--   * sin invitación válida el usuario crea su propia escuela (como antes).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_tenant_id uuid;
  meta jsonb;
  tenant_name text;
  inv_token uuid;
  inv_record record;
  target_role text;
  is_independent boolean;
BEGIN
  meta := new.raw_user_meta_data;
  BEGIN
    inv_token := (meta->>'invitationToken')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    inv_token := NULL;
  END;
  is_independent := (meta->>'mode' = 'INDEPENDENT');

  -- 1. ¿Se une con una invitación válida?
  IF inv_token IS NOT NULL THEN
    SELECT * INTO inv_record FROM public.staff_invitations
    WHERE token = inv_token
      AND status = 'PENDING'
      AND expires_at > now()
      AND lower(email) = lower(new.email)
      AND upper(role) IN ('DIRECTOR', 'ADMIN', 'ACADEMIC_COORD', 'TECH_COORD', 'SCHOOL_CONTROL',
                          'TEACHER', 'PREFECT', 'SUPPORT', 'TUTOR', 'STUDENT')
    FOR UPDATE;

    IF FOUND THEN
       new_tenant_id := inv_record.tenant_id;
       target_role := upper(inv_record.role);
       UPDATE public.staff_invitations SET status = 'ACCEPTED' WHERE id = inv_record.id;
    END IF;
  END IF;

  -- 2. Quien venía a unirse con invitación y no es válida: error claro
  --    (antes fallaba con un error de base de datos o creaba otra escuela).
  IF new_tenant_id IS NULL AND (inv_token IS NOT NULL OR meta->>'mode' = 'JOIN') THEN
    RAISE EXCEPTION 'La invitación no es válida, ya se usó, expiró o es para otro correo';
  END IF;

  -- 3. Sin invitación: crea su propia escuela / espacio
  IF new_tenant_id IS NULL THEN
    tenant_name := meta->>'organizationName';
    IF tenant_name IS NULL OR trim(tenant_name) = '' THEN
      tenant_name := trim(
        coalesce(meta->>'firstName', '') || ' ' ||
        coalesce(meta->>'lastNamePaternal', '') || ' ' ||
        coalesce(meta->>'lastNameMaternal', '')
      );
    END IF;

    IF is_independent THEN
      target_role := 'INDEPENDENT_TEACHER';
    ELSE
      target_role := 'DIRECTOR';
    END IF;

    INSERT INTO public.tenants (name, type)
    VALUES (tenant_name, CASE WHEN is_independent THEN 'INDEPENDENT' ELSE 'SCHOOL' END)
    RETURNING id INTO new_tenant_id;
  END IF;

  -- 4. Perfil
  INSERT INTO public.profiles (id, tenant_id, first_name, last_name_paternal, last_name_maternal, role, email)
  VALUES (new.id, new_tenant_id, meta->>'firstName', meta->>'lastNamePaternal', meta->>'lastNameMaternal', target_role, new.email);

  -- 5. Vínculo con la escuela (multi-escuela)
  INSERT INTO public.profile_tenants (profile_id, tenant_id, role, is_default)
  VALUES (new.id, new_tenant_id, target_role, true)
  ON CONFLICT DO NOTHING;

  RETURN new;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
