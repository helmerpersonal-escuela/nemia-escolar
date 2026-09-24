-- =====================================================================
-- Verificación de seguridad de la base de datos (solo lectura).
-- Simula ataques como usuario sin sesión (anon) y como docente normal.
-- TODO se revierte al final: no modifica datos.
--
-- Uso: pegar en Supabase → SQL Editor y ejecutar, o
--      psql "$DATABASE_URL" -f supabase/tests/security_checks.sql
-- Resultado esperado: un error final con el texto "OK: n verificaciones".
-- Si algo falla, el error dice "FALLA: ..." con la lista de problemas.
-- =====================================================================
DO $$
DECLARE
  fails text[] := '{}';
  ok int := 0;
  n int;
  uid uuid;
  own_tenant uuid;
  other_tenant uuid;
BEGIN
  -- Docente normal: alguien con vínculo a una escuela y sin Super Admin
  SELECT pt.profile_id, pt.tenant_id INTO uid, own_tenant
  FROM public.profile_tenants pt
  JOIN auth.users u ON u.id = pt.profile_id
  WHERE NOT EXISTS (SELECT 1 FROM public.profile_roles r WHERE r.profile_id = pt.profile_id AND r.role = 'SUPER_ADMIN')
    AND u.email NOT IN ('helmerferras@gmail.com', 'helmerpersonal@gmail.com')
  LIMIT 1;
  SELECT id INTO other_tenant FROM public.tenants WHERE id <> own_tenant LIMIT 1;

  -- ---------- Sin sesión (anon) ----------
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  SET LOCAL ROLE anon;
  BEGIN SELECT count(*) INTO n FROM public.profiles; fails := fails || 'anon lee profiles';
  EXCEPTION WHEN insufficient_privilege THEN ok := ok + 1; END;
  BEGIN SELECT count(*) INTO n FROM public.staff_attendance; fails := fails || 'anon lee staff_attendance';
  EXCEPTION WHEN insufficient_privilege THEN ok := ok + 1; END;
  BEGIN UPDATE public.system_settings SET value = value; fails := fails || 'anon modifica system_settings';
  EXCEPTION WHEN insufficient_privilege THEN ok := ok + 1; END;
  SELECT count(*) INTO n FROM public.system_settings WHERE public.system_setting_visibility(key) <> 'public';
  IF n = 0 THEN ok := ok + 1; ELSE fails := fails || 'anon ve secretos de system_settings'; END IF;
  BEGIN PERFORM public.back_to_god_mode(); fails := fails || 'anon ejecuta back_to_god_mode';
  EXCEPTION WHEN insufficient_privilege THEN ok := ok + 1; END;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname IN ('exec_sql','exec_query','query_json') AND pronamespace = 'public'::regnamespace) THEN
    fails := fails || 'existe una función de SQL arbitrario';
  ELSE ok := ok + 1; END IF;
  RESET ROLE;

  -- ---------- Docente normal ----------
  IF uid IS NULL THEN
    fails := fails || 'no hay usuario de prueba (docente con escuela)';
  ELSE
    PERFORM set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;

    BEGIN UPDATE public.profiles SET role = 'SUPER_ADMIN' WHERE id = uid; fails := fails || 'docente se asigna SUPER_ADMIN';
    EXCEPTION WHEN raise_exception THEN ok := ok + 1; END;
    BEGIN UPDATE public.profiles SET email = 'helmerpersonal@gmail.com' WHERE id = uid; fails := fails || 'docente cambia su correo en profiles';
    EXCEPTION WHEN raise_exception THEN ok := ok + 1; END;
    IF other_tenant IS NOT NULL THEN
      BEGIN UPDATE public.profiles SET tenant_id = other_tenant WHERE id = uid; fails := fails || 'docente se mueve a otra escuela';
      EXCEPTION WHEN raise_exception THEN ok := ok + 1; END;
    END IF;
    BEGIN PERFORM public.back_to_god_mode(); fails := fails || 'docente entra a God Mode';
    EXCEPTION WHEN raise_exception THEN ok := ok + 1; END;
    BEGIN PERFORM public.create_workspace('x', 'SCHOOL', 'SUPER_ADMIN'); fails := fails || 'docente crea escuela como SUPER_ADMIN';
    EXCEPTION WHEN raise_exception THEN ok := ok + 1; END;
    BEGIN PERFORM public.purge_account(uid); fails := fails || 'docente ejecuta purge_account';
    EXCEPTION WHEN raise_exception THEN ok := ok + 1; END;
    BEGIN INSERT INTO public.profile_roles (profile_id, role) VALUES (uid, 'DIRECTOR'); fails := fails || 'docente se asigna roles';
    EXCEPTION WHEN insufficient_privilege OR raise_exception THEN ok := ok + 1; END;
    BEGIN INSERT INTO public.licenses (tenant_id, plan_type) VALUES (own_tenant, 'PRO'); fails := fails || 'docente se regala una licencia';
    EXCEPTION WHEN insufficient_privilege THEN ok := ok + 1; END;
    BEGIN INSERT INTO public.system_settings (key, value) VALUES ('x_test', '1'); fails := fails || 'docente escribe system_settings';
    EXCEPTION WHEN insufficient_privilege OR check_violation THEN ok := ok + 1;
              WHEN others THEN IF SQLSTATE = '42501' THEN ok := ok + 1; ELSE fails := fails || ('system_settings: ' || SQLERRM); END IF; END;
    SELECT count(*) INTO n FROM public.view_god_mode_license_keys;
    IF n = 0 THEN ok := ok + 1; ELSE fails := fails || 'docente ve códigos de licencia'; END IF;
    BEGIN PERFORM public.generate_license_keys(1, 'pro', 30); fails := fails || 'docente genera licencias';
    EXCEPTION WHEN raise_exception THEN ok := ok + 1; END;
    SELECT count(*) INTO n FROM public.system_settings WHERE public.system_setting_visibility(key) = 'server';
    IF n = 0 THEN ok := ok + 1; ELSE fails := fails || 'docente ve secretos (tokens / llaves de IA)'; END IF;

    BEGIN INSERT INTO public.staff_invitations (tenant_id, email, role) VALUES (own_tenant, 'x@x.mx', 'DIRECTOR');
          fails := fails || 'docente crea invitación de Director';
    EXCEPTION WHEN insufficient_privilege THEN ok := ok + 1; END;

    -- Flujo normal: editar su propio nombre debe funcionar
    BEGIN UPDATE public.profiles SET first_name = first_name WHERE id = uid; ok := ok + 1;
    EXCEPTION WHEN others THEN fails := fails || ('docente NO puede editar su nombre: ' || SQLERRM); END;
    RESET ROLE;
  END IF;

  -- ---------- Estructura ----------
  SELECT count(*) INTO n FROM pg_class c
  WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r' AND NOT c.relrowsecurity;
  IF n = 0 THEN ok := ok + 1; ELSE fails := fails || (n || ' tablas públicas sin RLS'); END IF;

  SELECT count(*) INTO n FROM pg_proc p
  WHERE p.pronamespace = 'public'::regnamespace AND p.prosecdef
    AND has_function_privilege('anon', p.oid, 'EXECUTE')
    AND p.proname NOT IN ('get_invitation_info','is_god_mode','is_super_admin','is_super_admin_bypass','has_role_bypass',
                          'get_own_tenant_id_bypass','get_current_tenant_id','is_room_participant','get_current_role');
  IF n = 0 THEN ok := ok + 1; ELSE fails := fails || (n || ' funciones SECURITY DEFINER nuevas ejecutables sin sesión'); END IF;

  IF array_length(fails, 1) > 0 THEN
    RAISE EXCEPTION 'FALLA (% ok): %', ok, array_to_string(fails, ' | ');
  END IF;
  RAISE EXCEPTION 'OK: % verificaciones de seguridad superadas (todo revertido)', ok;
END $$;
