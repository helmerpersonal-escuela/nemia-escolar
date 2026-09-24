-- =====================================================================
-- FASE 1 DE SEGURIDAD (parte 2) — 23/09/2026
-- Hallazgos del asesor de seguridad de Supabase tras aplicar la parte 1.
-- =====================================================================

-- 1. Más funciones que ejecutaban SQL arbitrario o exponían datos
--    internos sin sesión. Ninguna la usa la app.
DROP FUNCTION IF EXISTS public.exec_query(text);
DROP FUNCTION IF EXISTS public.query_json(text);
DROP FUNCTION IF EXISTS public.check_env();
DROP FUNCTION IF EXISTS public.get_diagnostic_info();
DROP FUNCTION IF EXISTS public.get_storage_policies();
DROP FUNCTION IF EXISTS public.get_buckets();
DROP FUNCTION IF EXISTS public.inspect_tables();
DROP FUNCTION IF EXISTS public.inspect_table_schema(text);
DROP FUNCTION IF EXISTS public.inspect_global_tables(text);
DROP FUNCTION IF EXISTS public.inspect_global_columns(text);
DROP FUNCTION IF EXISTS public.get_tutors_json();

-- 2. Esquema privado (no expuesto por la API) para las implementaciones
--    originales; en public quedan envoltorios que verifican permisos.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

-- 2a. Borrado/restauración de cuentas: cualquiera podía borrar la cuenta
--     y los datos de CUALQUIER usuario.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname='purge_account' AND pronamespace='public'::regnamespace) THEN
    ALTER FUNCTION public.purge_account(uuid) SET SCHEMA private;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname='purge_auth_user_by_email' AND pronamespace='public'::regnamespace) THEN
    ALTER FUNCTION public.purge_auth_user_by_email(text) SET SCHEMA private;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname='restore_account' AND pronamespace='public'::regnamespace) THEN
    ALTER FUNCTION public.restore_account(uuid) SET SCHEMA private;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname='soft_delete_account' AND pronamespace='public'::regnamespace) THEN
    ALTER FUNCTION public.soft_delete_account(uuid) SET SCHEMA private;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname='get_or_create_system_room' AND pronamespace='public'::regnamespace) THEN
    ALTER FUNCTION public.get_or_create_system_room(uuid, uuid) SET SCHEMA private;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname='send_system_message' AND pronamespace='public'::regnamespace) THEN
    ALTER FUNCTION public.send_system_message(uuid, text, jsonb) SET SCHEMA private;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname='create_workspace' AND pronamespace='public'::regnamespace) THEN
    ALTER FUNCTION public.create_workspace(text, text, text) SET SCHEMA private;
  END IF;
END $$;

-- purge / restore: solo Super Admin
CREATE OR REPLACE FUNCTION public.purge_account(target_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_god_mode() THEN RAISE EXCEPTION 'No autorizado'; END IF;
  PERFORM private.purge_account(target_user_id);
END; $$;

CREATE OR REPLACE FUNCTION public.purge_auth_user_by_email(target_email text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_god_mode() THEN RAISE EXCEPTION 'No autorizado'; END IF;
  PERFORM private.purge_auth_user_by_email(target_email);
END; $$;

CREATE OR REPLACE FUNCTION public.restore_account(target_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_god_mode() THEN RAISE EXCEPTION 'No autorizado'; END IF;
  PERFORM private.restore_account(target_user_id);
END; $$;

-- soft delete: la propia cuenta o Super Admin
CREATE OR REPLACE FUNCTION public.soft_delete_account(target_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR (target_user_id <> auth.uid() AND NOT public.is_god_mode()) THEN
    RAISE EXCEPTION 'No autorizado: solo puedes dar de baja tu propia cuenta';
  END IF;
  PERFORM private.soft_delete_account(target_user_id);
END; $$;

-- 2b. Sala de avisos del sistema: solo para uno mismo y en su escuela
CREATE OR REPLACE FUNCTION public.get_or_create_system_room(p_tenant_id uuid, p_user_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR p_user_id <> auth.uid() OR NOT public.has_tenant_link(p_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  RETURN private.get_or_create_system_room(p_tenant_id, p_user_id);
END; $$;

-- Mensajes del sistema: solo en salas donde participa quien llama
CREATE OR REPLACE FUNCTION public.send_system_message(p_room_id uuid, p_content text, p_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_room_participant(p_room_id) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  RETURN private.send_system_message(p_room_id, p_content, p_metadata);
END; $$;

-- 2c. create_workspace aceptaba cualquier rol (incluido SUPER_ADMIN)
CREATE OR REPLACE FUNCTION public.create_workspace(workspace_name text, workspace_type text, workspace_role text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sesión requerida'; END IF;
  IF NOT public.is_god_mode()
     AND upper(coalesce(workspace_role, '')) NOT IN ('DIRECTOR', 'INDEPENDENT_TEACHER') THEN
    RAISE EXCEPTION 'No autorizado: rol no permitido al crear un espacio (%)', workspace_role;
  END IF;
  RETURN private.create_workspace(workspace_name, workspace_type, upper(workspace_role));
END; $$;

-- 3. is_super_admin() se basaba en profiles.role; ahora usa la misma
--    fuente confiable que is_god_mode().
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN public.is_god_mode();
END; $$;

-- 4. profile_roles: cualquier DIRECTOR podía asignar roles a cualquier
--    usuario de cualquier escuela. La app solo los lee; escribir queda
--    para Super Admin ("Super Admins can view all roles", FOR ALL).
DROP POLICY IF EXISTS "Admins can manage roles in their tenant" ON public.profile_roles;
REVOKE INSERT, UPDATE, DELETE ON public.profile_roles FROM anon;

-- 5. Vistas de God Mode: exponían correos de auth.users y los CÓDIGOS
--    de licencia sin canjear a cualquiera. Ahora solo devuelven filas
--    al Super Admin.
CREATE OR REPLACE VIEW public.view_god_mode_license_keys AS
SELECT lk.id, lk.code, lk.plan_type, lk.duration_days, lk.status, lk.created_by,
       lk.redeemed_by, lk.redeemed_at, lk.expires_at, lk.created_at,
       cu.email AS creator_email, ru.email AS redeemer_email
FROM public.license_keys lk
LEFT JOIN auth.users cu ON lk.created_by = cu.id
LEFT JOIN auth.users ru ON lk.redeemed_by = ru.id
WHERE public.is_god_mode();

CREATE OR REPLACE VIEW public.view_god_mode_subscriptions AS
SELECT s.id, s.user_id, s.status, s.plan_type, s.current_period_start, s.current_period_end,
       s.cancel_at_period_end, s.created_at, s.updated_at, s.mercadopago_subscription_id,
       s.mercadopago_customer_id, s.trial_start, s.trial_end,
       u.email AS user_email, p.first_name AS user_first_name,
       p.last_name_paternal AS user_last_name, p.avatar_url AS user_avatar_url
FROM public.subscriptions s
LEFT JOIN public.profiles p ON s.user_id = p.id
LEFT JOIN auth.users u ON s.user_id = u.id
WHERE public.is_god_mode();

CREATE OR REPLACE VIEW public.view_god_mode_transactions AS
SELECT pt.id, pt.subscription_id, pt.tenant_id, pt.user_id, pt.amount, pt.currency,
       pt.status, pt.provider, pt.provider_payment_id, pt.created_at, pt.meta,
       u.email AS user_email, p.first_name AS user_first_name
FROM public.payment_transactions pt
LEFT JOIN public.profiles p ON pt.user_id = p.id
LEFT JOIN auth.users u ON pt.user_id = u.id
WHERE public.is_god_mode();

REVOKE ALL ON public.view_god_mode_license_keys, public.view_god_mode_subscriptions, public.view_god_mode_transactions FROM anon;
GRANT SELECT ON public.view_god_mode_license_keys, public.view_god_mode_subscriptions, public.view_god_mode_transactions TO authenticated;

-- 6. Permisos de ejecución.
--    anon (sin sesión) solo conserva: get_invitation_info (registro por
--    invitación) y las funciones auxiliares que usan las políticas RLS.
DO $$
DECLARE f record;
  keep_for_anon text[] := ARRAY['get_invitation_info','is_god_mode','is_super_admin','is_super_admin_bypass',
                                'has_role_bypass','get_own_tenant_id_bypass','get_current_tenant_id',
                                'is_room_participant','get_current_role','system_setting_visibility'];
  trigger_only text[] := ARRAY['handle_new_user','handle_new_user_trial','process_audit_log','sync_profile_email',
                               'enforce_super_admin_limit','guard_profile_sensitive_columns','handle_updated_at',
                               'update_updated_at_column','update_chat_permissions_updated_at',
                               'handle_single_active_academic_year'];
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace AND p.prokind = 'f'
  LOOP
    IF f.proname = ANY(trigger_only) THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.sig);
    ELSIF NOT (f.proname = ANY(keep_for_anon)) THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f.sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f.sig);
    END IF;
  END LOOP;
END $$;

-- Funciones de mantenimiento que no debe llamar un usuario normal
REVOKE EXECUTE ON FUNCTION public.get_database_size() FROM authenticated;

-- Nuevas funciones: que no hereden EXECUTE para anon por defecto
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;

-- 7. Bug previo: los recordatorios de asistencia nunca se enviaban porque
--    chat_messages no aceptaba el tipo 'SYSTEM'.
ALTER TABLE public.chat_messages DROP CONSTRAINT IF EXISTS chat_messages_type_check;
ALTER TABLE public.chat_messages ADD CONSTRAINT chat_messages_type_check
  CHECK (type = ANY (ARRAY['TEXT','IMAGE','VIDEO','DOCUMENT','REPORT','STICKER','SYSTEM']));
