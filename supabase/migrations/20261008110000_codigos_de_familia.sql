-- Códigos de acceso para familias.
-- Control escolar imprime un código por alumno; la madre/padre entra con su cuenta
-- (Google o correo) y escribe el código. Así no se envían cientos de correos ni
-- contraseñas temporales.

ALTER TABLE public.students ADD COLUMN IF NOT EXISTS family_code text;
CREATE UNIQUE INDEX IF NOT EXISTS students_family_code_key
  ON public.students (family_code) WHERE family_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS private.family_code_attempts (
  id bigserial PRIMARY KEY,
  profile_id uuid NOT NULL,
  ok boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS family_code_attempts_profile_idx
  ON private.family_code_attempts (profile_id, created_at DESC);

-- Código de 8 caracteres sin letras ni números que se confundan (0/O, 1/I)
CREATE OR REPLACE FUNCTION private.new_family_code()
RETURNS text LANGUAGE plpgsql VOLATILE SET search_path TO 'public' AS $$
DECLARE
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  c text;
BEGIN
  LOOP
    c := '';
    FOR i IN 1..8 LOOP
      c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    c := substr(c, 1, 4) || '-' || substr(c, 5, 4);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.students WHERE family_code = c);
  END LOOP;
  RETURN c;
END $$;

-- ¿Quién puede ver e imprimir los códigos de una escuela?
CREATE OR REPLACE FUNCTION private.assert_family_code_manager(p_tenant uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sesión requerida' USING errcode = '42501';
  END IF;
  IF public.is_god_mode() THEN RETURN; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profile_tenants
     WHERE profile_id = auth.uid() AND tenant_id = p_tenant
       AND upper(role) IN ('DIRECTOR', 'ADMIN', 'SCHOOL_CONTROL', 'ACADEMIC_COORD', 'TECH_COORD')) THEN
    RAISE EXCEPTION 'Solo dirección, coordinación o control escolar pueden generar los códigos para familias'
      USING errcode = '42501';
  END IF;
END $$;

-- Lista de códigos de un grupo (crea los que falten; con p_regenerate cambia todos)
CREATE OR REPLACE FUNCTION public.family_codes_for_group(p_group uuid, p_regenerate boolean DEFAULT false)
RETURNS TABLE (student_id uuid, student_name text, code text, linked_accounts int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_tenant uuid;
BEGIN
  SELECT g.tenant_id INTO v_tenant FROM public.groups g WHERE g.id = p_group;
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'Grupo no encontrado'; END IF;
  PERFORM private.assert_family_code_manager(v_tenant);

  UPDATE public.students s SET family_code = private.new_family_code()
   WHERE s.group_id = p_group AND s.tenant_id = v_tenant
     AND (p_regenerate OR s.family_code IS NULL)
     AND coalesce(s.status, 'ACTIVE') NOT IN ('INACTIVE', 'DROPPED', 'BAJA');

  RETURN QUERY
  SELECT s.id,
         trim(concat_ws(' ', s.last_name_paternal, s.last_name_maternal, s.first_name)),
         s.family_code,
         (SELECT count(*)::int FROM public.guardians gu WHERE gu.student_id = s.id AND gu.user_id IS NOT NULL)
    FROM public.students s
   WHERE s.group_id = p_group AND s.tenant_id = v_tenant AND s.family_code IS NOT NULL
   ORDER BY s.last_name_paternal, s.last_name_maternal, s.first_name;
END $$;

-- Cambiar el código de un solo alumno (si se perdió o lo vio alguien más)
CREATE OR REPLACE FUNCTION public.regenerate_family_code(p_student uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_tenant uuid; v_code text;
BEGIN
  SELECT tenant_id INTO v_tenant FROM public.students WHERE id = p_student;
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'Alumno no encontrado'; END IF;
  PERFORM private.assert_family_code_manager(v_tenant);
  v_code := private.new_family_code();
  UPDATE public.students SET family_code = v_code WHERE id = p_student;
  RETURN v_code;
END $$;

-- La madre/padre canjea el código
CREATE OR REPLACE FUNCTION public.redeem_family_code(
  p_code text,
  p_first_name text DEFAULT NULL,
  p_last_name_paternal text DEFAULT NULL,
  p_last_name_maternal text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_clean text;
  v_code text;
  st record;
  v_email text;
  v_first text; v_lastp text; v_lastm text;
  v_has_workspace boolean;
  v_guardian uuid;
  v_school text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Inicia sesión para usar el código' USING errcode = '42501'; END IF;

  IF (SELECT count(*) FROM private.family_code_attempts
       WHERE profile_id = v_uid AND NOT ok AND created_at > now() - interval '1 hour') >= 10 THEN
    RAISE EXCEPTION 'Demasiados intentos con códigos incorrectos. Espera una hora o pide ayuda a control escolar.';
  END IF;

  v_clean := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  IF length(v_clean) <> 8 THEN
    -- Se regresa el error (sin RAISE) para que el intento fallido sí quede registrado
    INSERT INTO private.family_code_attempts (profile_id, ok) VALUES (v_uid, false);
    RETURN jsonb_build_object('error', 'El código tiene 8 letras y números, por ejemplo ABCD-2345');
  END IF;
  v_code := substr(v_clean, 1, 4) || '-' || substr(v_clean, 5, 4);

  SELECT s.id, s.tenant_id, s.first_name, s.last_name_paternal INTO st
    FROM public.students s WHERE s.family_code = v_code;
  IF st.id IS NULL THEN
    INSERT INTO private.family_code_attempts (profile_id, ok) VALUES (v_uid, false);
    RETURN jsonb_build_object('error', 'Ese código no existe. Revísalo con cuidado o pide uno nuevo a control escolar.');
  END IF;

  SELECT name INTO v_school FROM public.tenants WHERE id = st.tenant_id;

  -- Ya estaba ligado: no hacer nada más
  IF EXISTS (SELECT 1 FROM public.guardians WHERE student_id = st.id AND user_id = v_uid) THEN
    RETURN jsonb_build_object('student', st.first_name, 'school', v_school, 'already', true);
  END IF;

  IF (SELECT count(*) FROM public.guardians WHERE student_id = st.id AND user_id IS NOT NULL) >= 4 THEN
    RAISE EXCEPTION 'Este código ya se usó en varias cuentas. Pide uno nuevo a control escolar.';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
  SELECT upper(nullif(trim(coalesce(p_first_name, p.first_name)), '')),
         upper(nullif(trim(coalesce(p_last_name_paternal, p.last_name_paternal)), '')),
         upper(nullif(trim(coalesce(p_last_name_maternal, p.last_name_maternal)), ''))
    INTO v_first, v_lastp, v_lastm
    FROM public.profiles p WHERE p.id = v_uid;

  v_has_workspace := EXISTS (SELECT 1 FROM public.profile_tenants WHERE profile_id = v_uid);

  -- Cuenta nueva: queda como madre/padre de esa escuela
  IF NOT v_has_workspace THEN
    UPDATE public.profiles
       SET role = 'TUTOR', tenant_id = st.tenant_id,
           first_name = coalesce(v_first, first_name),
           last_name_paternal = coalesce(v_lastp, last_name_paternal),
           last_name_maternal = coalesce(v_lastm, last_name_maternal)
     WHERE id = v_uid;
  END IF;

  INSERT INTO public.profile_tenants (profile_id, tenant_id, role, is_default, first_name, last_name_paternal, last_name_maternal)
  VALUES (v_uid, st.tenant_id, 'TUTOR', NOT v_has_workspace, v_first, v_lastp, v_lastm)
  ON CONFLICT DO NOTHING;

  -- Ligar con el registro del tutor que capturó la escuela (mismo correo) o crear uno
  SELECT id INTO v_guardian FROM public.guardians
   WHERE student_id = st.id AND user_id IS NULL AND v_email IS NOT NULL AND lower(email) = lower(v_email)
   LIMIT 1;
  IF v_guardian IS NOT NULL THEN
    UPDATE public.guardians SET user_id = v_uid, profile_id = v_uid WHERE id = v_guardian;
  ELSE
    INSERT INTO public.guardians (tenant_id, student_id, first_name, last_name_paternal, last_name_maternal,
                                  relationship, email, user_id, profile_id)
    VALUES (st.tenant_id, st.id, coalesce(v_first, 'SIN NOMBRE'), coalesce(v_lastp, ''), v_lastm,
            'TUTOR', v_email, v_uid, v_uid);
  END IF;

  INSERT INTO private.family_code_attempts (profile_id, ok) VALUES (v_uid, true);
  RETURN jsonb_build_object('student', st.first_name, 'school', v_school, 'already', false);
END $$;

REVOKE ALL ON FUNCTION public.family_codes_for_group(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.regenerate_family_code(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.redeem_family_code(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.family_codes_for_group(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.regenerate_family_code(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_family_code(text, text, text, text) TO authenticated;
REVOKE ALL ON FUNCTION private.new_family_code() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.assert_family_code_manager(uuid) FROM PUBLIC, anon, authenticated;
