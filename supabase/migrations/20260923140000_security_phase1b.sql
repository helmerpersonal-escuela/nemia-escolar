-- =====================================================================
-- FASE 1b DE SEGURIDAD — 23/09/2026
-- =====================================================================

-- 1. Llaves de IA: ahora solo las lee el servidor (función ai-proxy).
--    Antes cualquier usuario con sesión podía copiarlas.
CREATE OR REPLACE FUNCTION public.system_setting_visibility(setting_key text)
RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
    SELECT CASE
        WHEN setting_key = 'mercadopago_public_key' THEN 'public'
        WHEN setting_key ~* '(access_token|token|secret|password|passwd|smtp_pass|smtp_user|service_role|webhook|private)' THEN 'server'
        WHEN setting_key ~* '(openai|gemini|groq|anthropic)_key' THEN 'server'
        WHEN setting_key ~* '^ai_' THEN 'server'
        ELSE 'public'
    END;
$$;

-- 2. Registro de uso de IA (para límite diario y control de costos)
CREATE TABLE IF NOT EXISTS public.ai_usage (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action text NOT NULL,
    provider text,
    chars integer DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_created ON public.ai_usage (user_id, created_at DESC);
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users see own AI usage" ON public.ai_usage;
CREATE POLICY "Users see own AI usage" ON public.ai_usage
FOR SELECT USING (user_id = auth.uid() OR public.is_god_mode());
REVOKE ALL ON public.ai_usage FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.ai_usage FROM authenticated;

-- 3. Prueba gratis: se podía reiniciar infinitas veces, elegir cualquier
--    plan y hasta sobrescribir una suscripción PAGADA.
CREATE OR REPLACE FUNCTION public.start_free_trial(p_plan_type text)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_plan text := lower(coalesce(p_plan_type, 'basic'));
  v_sub record;
  v_days int;
  v_trial_end timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No user logged in');
  END IF;
  IF v_plan NOT IN ('basic', 'pro') THEN
    RETURN json_build_object('success', false, 'error', 'Plan no válido');
  END IF;

  SELECT * INTO v_sub FROM public.subscriptions WHERE user_id = v_user_id;

  IF FOUND AND v_sub.status = 'active' THEN
    RETURN json_build_object('success', false, 'error', 'Ya tienes una suscripción activa');
  END IF;
  IF FOUND AND v_sub.trial_start IS NOT NULL THEN
    -- Ya usó su prueba: respuesta idempotente, sin reiniciar fechas
    RETURN json_build_object('success', v_sub.status = 'trialing' AND v_sub.trial_end > now(),
                             'message', 'El periodo de prueba ya fue utilizado',
                             'trial_end', v_sub.trial_end);
  END IF;

  SELECT coalesce(trial_days, 30) INTO v_days FROM public.license_limits WHERE plan_type = v_plan;
  v_trial_end := now() + make_interval(days => coalesce(v_days, 30));

  INSERT INTO public.subscriptions (user_id, status, plan_type, trial_start, trial_end, current_period_start, current_period_end)
  VALUES (v_user_id, 'trialing', v_plan, now(), v_trial_end, now(), v_trial_end)
  ON CONFLICT (user_id) DO UPDATE SET
    status = 'trialing',
    plan_type = EXCLUDED.plan_type,
    trial_start = EXCLUDED.trial_start,
    trial_end = EXCLUDED.trial_end,
    current_period_start = EXCLUDED.current_period_start,
    current_period_end = EXCLUDED.current_period_end;

  INSERT INTO public.profile_roles (profile_id, role) VALUES (v_user_id, 'TEACHER') ON CONFLICT DO NOTHING;

  RETURN json_build_object('success', true, 'message', 'Free trial started successfully', 'trial_end', v_trial_end);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.start_free_trial(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_free_trial(text) TO authenticated;

-- 4. Planes y licencias: escritura solo Super Admin (confiable)
DROP POLICY IF EXISTS "Super Admins manage license limits" ON public.license_limits;
CREATE POLICY "Super Admins manage license limits" ON public.license_limits
FOR ALL USING (public.is_god_mode()) WITH CHECK (public.is_god_mode());

DROP POLICY IF EXISTS "Super Admins can manage license keys" ON public.license_keys;

-- 5. search_path fijo en las funciones restantes (evita secuestro de
--    funciones por objetos con el mismo nombre en otro esquema).
DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace AND p.prokind = 'f'
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
      AND (p.proconfig IS NULL OR NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%'))
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, extensions', f.sig);
  END LOOP;
END $$;

-- 6. Las llaves de IA no deben guardarse en tenants.ai_config (la tabla
--    tenants es legible públicamente). El trigger las descarta.
CREATE OR REPLACE FUNCTION public.strip_ai_keys_from_tenant()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.ai_config IS NOT NULL AND jsonb_typeof(NEW.ai_config::jsonb) = 'object' THEN
    NEW.ai_config := (NEW.ai_config::jsonb - 'apiKey' - 'groq_key' - 'gemini_key' - 'openai_key' - 'anthropic_key');
  END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.strip_ai_keys_from_tenant() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS tr_strip_ai_keys_from_tenant ON public.tenants;
CREATE TRIGGER tr_strip_ai_keys_from_tenant
BEFORE INSERT OR UPDATE OF ai_config ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.strip_ai_keys_from_tenant();

-- 7. search_path fijo también en las implementaciones privadas
ALTER FUNCTION private.purge_account(uuid) SET search_path = public, extensions;
ALTER FUNCTION private.restore_account(uuid) SET search_path = public, extensions;
ALTER FUNCTION private.soft_delete_account(uuid) SET search_path = public, extensions;
ALTER FUNCTION private.purge_auth_user_by_email(text) SET search_path = public, extensions;
