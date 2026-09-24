-- =====================================================================
-- Alta de cuentas con Google (OAuth) y registro de docente / escuela
--
-- Antes: cualquier alta sin "mode" (p. ej. Google, o tutores creados por la
-- escuela) creaba una escuela nueva y dejaba al usuario como DIRECTOR.
-- Ahora:
--   * Alta con Google sin tipo de cuenta → perfil "PENDING" sin escuela; la app
--     lo manda a /complete-signup para elegir Docente o Escuela (o invitación).
--   * Tutores creados por la escuela (invite-tutor) → quedan como TUTOR de esa
--     escuela (dato en app_metadata, que el usuario no puede alterar).
-- =====================================================================

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role = ANY (ARRAY[
    'ADMIN', 'TEACHER', 'TUTOR', 'STUDENT', 'INDEPENDENT_TEACHER', 'DIRECTOR', 'ACADEMIC_COORD',
    'TECH_COORD', 'SCHOOL_CONTROL', 'PREFECT', 'SUPPORT', 'SUPER_ADMIN', 'PENDING']));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_tenant_id uuid;
  meta jsonb;
  app  jsonb;
  tenant_name text;
  inv_token uuid;
  inv_record record;
  target_role text;
  is_independent boolean;
BEGIN
  meta := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  app  := coalesce(new.raw_app_meta_data, '{}'::jsonb);
  BEGIN
    inv_token := (meta->>'invitationToken')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    inv_token := NULL;
  END;
  is_independent := (meta->>'mode' = 'INDEPENDENT');

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

  IF new_tenant_id IS NULL AND (inv_token IS NOT NULL OR meta->>'mode' = 'JOIN') THEN
    RAISE EXCEPTION 'La invitación no es válida, ya se usó, expiró o es para otro correo';
  END IF;

  -- Tutor dado de alta por la escuela (app_metadata solo lo escribe el servidor).
  IF new_tenant_id IS NULL AND app->>'invited_role' = 'TUTOR'
     AND public.try_uuid(app->>'invited_tenant') IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.tenants WHERE id = public.try_uuid(app->>'invited_tenant')) THEN
    new_tenant_id := public.try_uuid(app->>'invited_tenant');
    target_role := 'TUTOR';
  END IF;

  -- Alta sin tipo de cuenta (Google u otro proveedor): se completa en la app.
  IF new_tenant_id IS NULL AND coalesce(meta->>'mode', '') NOT IN ('INDEPENDENT', 'SCHOOL') THEN
    INSERT INTO public.profiles (id, tenant_id, first_name, last_name_paternal, full_name, avatar_url, role, email)
    VALUES (
      new.id, NULL,
      upper(nullif(coalesce(meta->>'firstName', meta->>'given_name'), '')),
      upper(nullif(coalesce(meta->>'lastNamePaternal', meta->>'family_name'), '')),
      nullif(coalesce(meta->>'full_name', meta->>'name'), ''),
      nullif(coalesce(meta->>'avatar_url', meta->>'picture'), ''),
      'PENDING', new.email)
    ON CONFLICT (id) DO NOTHING;
    RETURN new;
  END IF;

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

  INSERT INTO public.profiles (id, tenant_id, first_name, last_name_paternal, last_name_maternal, role, email)
  VALUES (new.id, new_tenant_id, meta->>'firstName', meta->>'lastNamePaternal', meta->>'lastNameMaternal', target_role, new.email);

  INSERT INTO public.profile_tenants (profile_id, tenant_id, role, is_default, first_name, last_name_paternal, last_name_maternal)
  VALUES (new.id, new_tenant_id, target_role, true, meta->>'firstName', meta->>'lastNamePaternal', meta->>'lastNameMaternal')
  ON CONFLICT DO NOTHING;

  RETURN new;
END;
$function$;

-- ¿La cuenta ya tiene escuela / espacio docente?
CREATE OR REPLACE FUNCTION public.my_signup_status()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT jsonb_build_object(
        'has_workspace', EXISTS (SELECT 1 FROM public.profile_tenants WHERE profile_id = auth.uid()),
        'is_super_admin', public.is_god_mode(),
        'email', (SELECT email FROM auth.users WHERE id = auth.uid()),
        'first_name', p.first_name,
        'last_name_paternal', p.last_name_paternal,
        'last_name_maternal', p.last_name_maternal,
        'full_name', p.full_name
    )
    FROM (SELECT 1) x
    LEFT JOIN public.profiles p ON p.id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.my_signup_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_signup_status() TO authenticated;

-- Completar el registro tras entrar con Google: crear espacio docente o escuela,
-- o unirse con una invitación dirigida a su correo.
CREATE OR REPLACE FUNCTION public.complete_signup(
    p_mode text,
    p_organization_name text DEFAULT NULL,
    p_first_name text DEFAULT NULL,
    p_last_name_paternal text DEFAULT NULL,
    p_last_name_maternal text DEFAULT NULL,
    p_invitation uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid    uuid := auth.uid();
    v_email  text;
    v_tenant uuid;
    v_role   text;
    v_mode   text := upper(coalesce(p_mode, ''));
    v_name   text := nullif(trim(coalesce(p_organization_name, '')), '');
    v_first  text := nullif(upper(trim(coalesce(p_first_name, ''))), '');
    v_pat    text := nullif(upper(trim(coalesce(p_last_name_paternal, ''))), '');
    v_mat    text := nullif(upper(trim(coalesce(p_last_name_maternal, ''))), '');
    inv      record;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Sesión requerida' USING ERRCODE = '42501';
    END IF;
    IF EXISTS (SELECT 1 FROM public.profile_tenants WHERE profile_id = v_uid) THEN
        RAISE EXCEPTION 'Tu cuenta ya tiene un espacio de trabajo';
    END IF;
    IF v_first IS NULL OR v_pat IS NULL THEN
        RAISE EXCEPTION 'Escribe tu nombre y primer apellido';
    END IF;
    SELECT email INTO v_email FROM auth.users WHERE id = v_uid;

    IF p_invitation IS NOT NULL OR v_mode = 'JOIN' THEN
        SELECT * INTO inv FROM public.staff_invitations
         WHERE token = p_invitation
           AND status = 'PENDING'
           AND expires_at > now()
           AND lower(email) = lower(v_email)
           AND upper(role) IN ('DIRECTOR', 'ADMIN', 'ACADEMIC_COORD', 'TECH_COORD', 'SCHOOL_CONTROL',
                               'TEACHER', 'PREFECT', 'SUPPORT', 'TUTOR', 'STUDENT')
         FOR UPDATE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'La invitación no es válida, ya se usó, expiró o es para otro correo';
        END IF;
        v_tenant := inv.tenant_id;
        v_role := upper(inv.role);
        UPDATE public.staff_invitations SET status = 'ACCEPTED' WHERE id = inv.id;
    ELSIF v_mode IN ('INDEPENDENT', 'SCHOOL') THEN
        IF v_mode = 'SCHOOL' AND v_name IS NULL THEN
            RAISE EXCEPTION 'Escribe el nombre de la escuela';
        END IF;
        v_name := upper(coalesce(v_name, concat_ws(' ', v_first, v_pat, v_mat)));
        v_role := CASE WHEN v_mode = 'INDEPENDENT' THEN 'INDEPENDENT_TEACHER' ELSE 'DIRECTOR' END;
        INSERT INTO public.tenants (name, type) VALUES (left(v_name, 200), v_mode) RETURNING id INTO v_tenant;
    ELSE
        RAISE EXCEPTION 'Elige si la cuenta es de docente o de escuela';
    END IF;

    INSERT INTO public.profile_tenants (profile_id, tenant_id, role, is_default, first_name, last_name_paternal, last_name_maternal)
    VALUES (v_uid, v_tenant, v_role, true, v_first, v_pat, v_mat)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.profiles (id, tenant_id, first_name, last_name_paternal, last_name_maternal, role, email)
    VALUES (v_uid, v_tenant, v_first, v_pat, v_mat, v_role, v_email)
    ON CONFLICT (id) DO UPDATE
        SET tenant_id = EXCLUDED.tenant_id,
            role = EXCLUDED.role,
            first_name = EXCLUDED.first_name,
            last_name_paternal = EXCLUDED.last_name_paternal,
            last_name_maternal = EXCLUDED.last_name_maternal;

    RETURN v_tenant;
END;
$$;
REVOKE ALL ON FUNCTION public.complete_signup(text, text, text, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_signup(text, text, text, text, text, uuid) TO authenticated;
