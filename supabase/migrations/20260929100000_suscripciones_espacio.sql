-- Suscripciones por ESPACIO (escuela o docente independiente).
--  * Al crear el espacio empieza una prueba gratuita de 30 días sin pedir pago.
--  * Planes: mensual $75 y anual $700 (editables en billing_plans).
--  * Pago en la web con Mercado Pago: cobro automático (preapproval) o pago único por periodo.
--  * Códigos promocionales (descuento) y claves de licencia de 12 caracteres (3, 6 o 12 meses)
--    que se generan en modo dios.
--  * Avisos: 7 días y 1 día antes de que termine la prueba o el periodo (si no hay cobro automático),
--    al vencer y cuando falla un cobro automático.

-- 0) Sistema de licencias anterior (por usuario, sin uso: 0 registros)
DROP FUNCTION IF EXISTS public.redeem_license_key(text);
DROP FUNCTION IF EXISTS public.generate_license_keys(integer, text, integer);
DO $$ BEGIN
  IF to_regclass('public.license_keys') IS NOT NULL
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'license_keys' AND column_name = 'code')
     AND (SELECT count(*) FROM public.license_keys) = 0 THEN
    DROP VIEW IF EXISTS public.view_god_mode_license_keys;
    DROP TABLE public.license_keys;
  END IF;
END $$;

-- 1) Planes ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.billing_plans (
    code        text PRIMARY KEY CHECK (code IN ('MONTHLY', 'ANNUAL')),
    name        text NOT NULL,
    price       numeric(10,2) NOT NULL CHECK (price > 0),
    months      integer NOT NULL CHECK (months IN (1, 12)),
    active      boolean NOT NULL DEFAULT true,
    updated_at  timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.billing_plans (code, name, price, months) VALUES
    ('MONTHLY', 'Mensual', 75, 1),
    ('ANNUAL', 'Anual', 700, 12)
ON CONFLICT (code) DO NOTHING;

-- 2) Suscripción del espacio ------------------------------------------------
CREATE TABLE IF NOT EXISTS public.space_subscriptions (
    tenant_id           uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
    status              text NOT NULL DEFAULT 'TRIAL' CHECK (status IN ('TRIAL', 'ACTIVE', 'PAST_DUE', 'EXPIRED', 'CANCELED')),
    plan                text NOT NULL DEFAULT 'TRIAL' CHECK (plan IN ('TRIAL', 'MONTHLY', 'ANNUAL', 'LICENSE')),
    trial_ends_at       timestamptz,
    current_period_end  timestamptz,
    auto_renew          boolean NOT NULL DEFAULT false,
    price               numeric(10,2),
    promo_code          text,
    mp_preapproval_id   text,
    payer_user_id       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    payer_email         text,
    notices             jsonb NOT NULL DEFAULT '{}'::jsonb,   -- avisos ya enviados en este periodo
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

-- 3) Códigos promocionales ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.promo_codes (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code            text NOT NULL UNIQUE CHECK (code = upper(code) AND code ~ '^[A-Z0-9_-]{3,30}$'),
    description     text,
    discount_type   text NOT NULL DEFAULT 'PERCENT' CHECK (discount_type IN ('PERCENT', 'AMOUNT')),
    discount_value  numeric(10,2) NOT NULL CHECK (discount_value > 0),
    applies_to      text NOT NULL DEFAULT 'ALL' CHECK (applies_to IN ('ALL', 'MONTHLY', 'ANNUAL')),
    max_uses        integer CHECK (max_uses IS NULL OR max_uses > 0),
    uses            integer NOT NULL DEFAULT 0,
    valid_until     date,
    active          boolean NOT NULL DEFAULT true,
    created_by      uuid DEFAULT auth.uid(),
    created_at      timestamptz NOT NULL DEFAULT now(),
    CHECK (discount_type <> 'PERCENT' OR discount_value <= 100)
);

-- 4) Claves de licencia -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.license_keys (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key              text NOT NULL UNIQUE CHECK (key ~ '^[A-Z0-9]{12}$'),
    months           integer NOT NULL CHECK (months IN (3, 6, 12)),
    status           text NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'REDEEMED', 'REVOKED')),
    note             text,
    created_by       uuid DEFAULT auth.uid(),
    created_at       timestamptz NOT NULL DEFAULT now(),
    redeemed_tenant  uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
    redeemed_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    redeemed_at      timestamptz
);

-- 5) Bitácora y avisos -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.billing_events (
    id          bigserial PRIMARY KEY,
    tenant_id   uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id     uuid,
    kind        text NOT NULL,       -- TRIAL_STARTED, PAYMENT, RENEWAL, LICENSE, KEY_FAILED, PREAPPROVAL, NOTICE, EXPIRED…
    amount      numeric(10,2),
    detail      jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS billing_events_tenant_idx ON public.billing_events (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS billing_events_user_kind_idx ON public.billing_events (user_id, kind, created_at DESC);

CREATE TABLE IF NOT EXISTS public.billing_notices (
    id          bigserial PRIMARY KEY,
    tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    kind        text NOT NULL,       -- TRIAL_7D, TRIAL_1D, TRIAL_ENDED, RENEW_7D, RENEW_1D, EXPIRED, PAYMENT_FAILED
    email       text NOT NULL,
    name        text,
    payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
    sent_at     timestamptz,
    error       text,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS billing_notices_pending_idx ON public.billing_notices (created_at) WHERE sent_at IS NULL;

-- 6) RLS -----------------------------------------------------------------------
ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.space_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.license_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_notices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone reads plans" ON public.billing_plans;
CREATE POLICY "Anyone reads plans" ON public.billing_plans FOR SELECT USING (true);
DROP POLICY IF EXISTS "God manages plans" ON public.billing_plans;
CREATE POLICY "God manages plans" ON public.billing_plans FOR ALL TO authenticated USING (public.is_god_mode()) WITH CHECK (public.is_god_mode());

DROP POLICY IF EXISTS "Members read space subscription" ON public.space_subscriptions;
CREATE POLICY "Members read space subscription" ON public.space_subscriptions FOR SELECT TO authenticated
    USING (public.is_god_mode() OR EXISTS (SELECT 1 FROM public.profile_tenants pt WHERE pt.profile_id = auth.uid() AND pt.tenant_id = space_subscriptions.tenant_id));
DROP POLICY IF EXISTS "God manages space subscriptions" ON public.space_subscriptions;
CREATE POLICY "God manages space subscriptions" ON public.space_subscriptions FOR ALL TO authenticated USING (public.is_god_mode()) WITH CHECK (public.is_god_mode());

DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['promo_codes', 'license_keys', 'billing_events', 'billing_notices'] LOOP
        EXECUTE format('DROP POLICY IF EXISTS "God manages %1$s" ON public.%1$I', t);
        EXECUTE format('CREATE POLICY "God manages %1$s" ON public.%1$I FOR ALL TO authenticated USING (public.is_god_mode()) WITH CHECK (public.is_god_mode())', t);
    END LOOP;
END $$;

-- 7) Prueba gratuita automática al crear el espacio ------------------------
CREATE OR REPLACE FUNCTION public.billing_trial_days()
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
    SELECT coalesce((SELECT nullif(value, '')::int FROM system_settings WHERE key = 'trial_days'), 30)
$$;

CREATE OR REPLACE FUNCTION public.tg_space_trial()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
    INSERT INTO public.space_subscriptions (tenant_id, status, plan, trial_ends_at)
    VALUES (NEW.id, 'TRIAL', 'TRIAL', now() + make_interval(days => public.billing_trial_days()))
    ON CONFLICT (tenant_id) DO NOTHING;
    INSERT INTO public.billing_events (tenant_id, kind, detail) VALUES (NEW.id, 'TRIAL_STARTED', jsonb_build_object('days', public.billing_trial_days()));
    RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tr_space_trial ON public.tenants;
CREATE TRIGGER tr_space_trial AFTER INSERT ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.tg_space_trial();

-- Espacios existentes: prueba desde su creación (mínimo 30 días a partir de hoy)
INSERT INTO public.space_subscriptions (tenant_id, status, plan, trial_ends_at)
SELECT t.id, 'TRIAL', 'TRIAL', greatest(t.created_at + interval '30 days', now() + interval '30 days')
FROM public.tenants t
ON CONFLICT (tenant_id) DO NOTHING;

-- La prueba por usuario ya no aplica: ahora es por espacio.
DROP TRIGGER IF EXISTS on_auth_user_created_trial ON auth.users;

-- 8) Acceso ----------------------------------------------------------------------
-- ¿Quién administra la suscripción del espacio?
CREATE OR REPLACE FUNCTION public.billing_can_manage(p_tenant uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
    SELECT public.is_god_mode() OR EXISTS (
        SELECT 1 FROM profile_tenants pt JOIN tenants t ON t.id = pt.tenant_id
        WHERE pt.profile_id = auth.uid() AND pt.tenant_id = p_tenant
          AND (t.type = 'INDEPENDENT' OR upper(pt.role) IN ('DIRECTOR', 'ADMIN')))
$$;

CREATE OR REPLACE FUNCTION public.space_access(p_tenant uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
    v_tenant uuid := coalesce(p_tenant, public.get_current_tenant_id());
    s record;
    v_end timestamptz;
    v_access boolean;
    v_grace boolean := false;
    v_type text;
BEGIN
    IF auth.uid() IS NULL THEN RETURN jsonb_build_object('has_access', false, 'reason', 'NO_SESSION'); END IF;
    IF public.is_god_mode() AND v_tenant IS NULL THEN RETURN jsonb_build_object('has_access', true, 'status', 'GOD'); END IF;
    IF v_tenant IS NULL THEN RETURN jsonb_build_object('has_access', true, 'status', 'NO_SPACE'); END IF;
    IF NOT public.is_god_mode() AND NOT EXISTS (SELECT 1 FROM profile_tenants WHERE profile_id = auth.uid() AND tenant_id = v_tenant) THEN
        RETURN jsonb_build_object('has_access', false, 'reason', 'NOT_MEMBER');
    END IF;

    SELECT type INTO v_type FROM tenants WHERE id = v_tenant;
    SELECT * INTO s FROM space_subscriptions WHERE tenant_id = v_tenant;
    IF NOT FOUND THEN
        -- Espacio sin registro (no debería pasar): se trata como prueba vigente
        RETURN jsonb_build_object('has_access', true, 'status', 'TRIAL', 'plan', 'TRIAL', 'days_left', public.billing_trial_days(),
            'can_manage', public.billing_can_manage(v_tenant), 'tenant_type', v_type);
    END IF;

    v_end := CASE WHEN s.status = 'TRIAL' THEN s.trial_ends_at ELSE s.current_period_end END;
    v_access := CASE
        WHEN s.status = 'TRIAL' THEN s.trial_ends_at > now()
        WHEN s.status IN ('ACTIVE', 'CANCELED') THEN s.current_period_end > now()
        WHEN s.status = 'PAST_DUE' THEN s.current_period_end + interval '3 days' > now()   -- gracia si falló el cobro
        ELSE false END;
    IF s.status = 'PAST_DUE' AND s.current_period_end <= now() AND v_access THEN v_grace := true; END IF;
    IF public.is_god_mode() THEN v_access := true; END IF;

    RETURN jsonb_build_object(
        'has_access', v_access,
        'status', s.status,
        'plan', s.plan,
        'ends_at', v_end,
        'days_left', CASE WHEN v_end IS NULL THEN NULL ELSE ceil(extract(epoch FROM (v_end - now())) / 86400)::int END,
        'auto_renew', s.auto_renew,
        'price', s.price,
        'promo_code', s.promo_code,
        'in_grace', v_grace,
        'can_manage', public.billing_can_manage(v_tenant),
        'tenant_type', v_type,
        'tenant_id', v_tenant);
END $$;

-- 9) Cotización con código promocional -----------------------------------
CREATE OR REPLACE FUNCTION public.billing_quote(p_plan text, p_code text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
    pl record;
    pc record;
    v_code text := nullif(upper(trim(coalesce(p_code, ''))), '');
    v_discount numeric := 0;
    v_msg text;
    v_label text;
    v_desc text;
BEGIN
    SELECT * INTO pl FROM billing_plans WHERE code = upper(p_plan) AND active;
    IF NOT FOUND THEN RAISE EXCEPTION 'Plan no válido'; END IF;
    IF v_code IS NOT NULL THEN
        SELECT * INTO pc FROM promo_codes WHERE code = v_code;
        IF NOT FOUND THEN v_msg := 'El código no existe o ya no está activo';
        ELSIF NOT pc.active THEN v_msg := 'El código no existe o ya no está activo';
        ELSIF pc.valid_until IS NOT NULL AND pc.valid_until < current_date THEN v_msg := 'El código ya venció';
        ELSIF pc.max_uses IS NOT NULL AND pc.uses >= pc.max_uses THEN v_msg := 'El código ya se usó el máximo de veces';
        ELSIF pc.applies_to <> 'ALL' AND pc.applies_to <> pl.code THEN
            v_msg := CASE WHEN pc.applies_to = 'MONTHLY' THEN 'El código solo aplica al plan mensual' ELSE 'El código solo aplica al plan anual' END;
        ELSE
            v_discount := CASE WHEN pc.discount_type = 'PERCENT' THEN round(pl.price * pc.discount_value / 100, 2) ELSE pc.discount_value END;
            v_discount := least(v_discount, pl.price - 1);   -- siempre queda al menos $1 (Mercado Pago no cobra $0)
            v_label := CASE WHEN pc.discount_type = 'PERCENT' THEN trim(to_char(pc.discount_value, 'FM990.##'), '.') || '% de descuento'
                            ELSE '$' || trim(to_char(pc.discount_value, 'FM999990.00')) || ' de descuento' END;
            v_desc := coalesce(pc.description, 'Código aplicado');
        END IF;
    END IF;
    RETURN jsonb_build_object(
        'plan', pl.code, 'name', pl.name, 'months', pl.months, 'base', pl.price,
        'discount', v_discount, 'final', pl.price - v_discount,
        'code', CASE WHEN v_msg IS NULL THEN v_code END,
        'code_valid', v_code IS NOT NULL AND v_msg IS NULL,
        'code_message', coalesce(v_msg, v_desc),
        'discount_label', v_label);
END $$;

-- 10) Extender el periodo (lo usa el webhook con service role) -----------
CREATE OR REPLACE FUNCTION public.billing_extend(p_tenant uuid, p_months int, p_plan text, p_kind text,
    p_amount numeric DEFAULT NULL, p_detail jsonb DEFAULT '{}'::jsonb, p_auto_renew boolean DEFAULT NULL)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
    s record;
    v_base timestamptz;
    v_end timestamptz;
BEGIN
    SELECT * INTO s FROM space_subscriptions WHERE tenant_id = p_tenant FOR UPDATE;
    IF NOT FOUND THEN
        INSERT INTO space_subscriptions (tenant_id, status, plan) VALUES (p_tenant, 'EXPIRED', 'TRIAL') RETURNING * INTO s;
    END IF;
    -- Se suma a lo que quede vigente (no se pierden días de prueba ni de licencia)
    v_base := greatest(now(),
        CASE WHEN s.status = 'TRIAL' THEN coalesce(s.trial_ends_at, now())
             WHEN s.status IN ('ACTIVE', 'CANCELED', 'PAST_DUE') THEN coalesce(s.current_period_end, now())
             ELSE now() END);
    v_end := v_base + make_interval(months => p_months);
    UPDATE space_subscriptions SET
        status = 'ACTIVE', plan = p_plan, current_period_end = v_end,
        auto_renew = coalesce(p_auto_renew, auto_renew),
        notices = '{}'::jsonb, updated_at = now()
    WHERE tenant_id = p_tenant;
    INSERT INTO billing_events (tenant_id, user_id, kind, amount, detail) VALUES (p_tenant, auth.uid(), p_kind, p_amount, p_detail || jsonb_build_object('months', p_months, 'until', v_end));
    RETURN v_end;
END $$;
REVOKE EXECUTE ON FUNCTION public.billing_extend(uuid, int, text, text, numeric, jsonb, boolean) FROM PUBLIC, anon, authenticated;

-- 11) Canjear clave de licencia ----------------------------------------------
CREATE OR REPLACE FUNCTION public.redeem_license_key(p_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
    v_tenant uuid := public.get_current_tenant_id();
    v_key text := upper(regexp_replace(coalesce(p_key, ''), '[^A-Za-z0-9]', '', 'g'));
    k record;
    v_end timestamptz;
    v_fails int;
    v_found boolean;
BEGIN
    IF auth.uid() IS NULL OR v_tenant IS NULL THEN RAISE EXCEPTION 'Inicia sesión en tu espacio'; END IF;
    IF NOT public.billing_can_manage(v_tenant) THEN RAISE EXCEPTION 'Solo la dirección o el titular del espacio puede activar licencias'; END IF;

    SELECT count(*) INTO v_fails FROM billing_events WHERE user_id = auth.uid() AND kind = 'KEY_FAILED' AND created_at > now() - interval '1 hour';
    IF v_fails >= 8 THEN RAISE EXCEPTION 'Demasiados intentos. Espera una hora e inténtalo de nuevo.'; END IF;

    IF length(v_key) <> 12 THEN
        RAISE EXCEPTION 'La clave debe tener 12 caracteres';
    END IF;
    SELECT * INTO k FROM license_keys WHERE key = v_key FOR UPDATE;
    v_found := FOUND;
    IF NOT v_found OR k.status <> 'AVAILABLE' THEN
        INSERT INTO billing_events (tenant_id, user_id, kind, detail) VALUES (v_tenant, auth.uid(), 'KEY_FAILED', jsonb_build_object('key_tail', right(v_key, 4)));
        RETURN jsonb_build_object('success', false, 'error', CASE WHEN v_found AND k.status = 'REDEEMED' THEN 'Esta clave ya fue utilizada' ELSE 'La clave no es válida' END);
    END IF;

    v_end := public.billing_extend(v_tenant, k.months, 'LICENSE', 'LICENSE', NULL, jsonb_build_object('key_id', k.id));
    UPDATE license_keys SET status = 'REDEEMED', redeemed_tenant = v_tenant, redeemed_by = auth.uid(), redeemed_at = now() WHERE id = k.id;
    RETURN jsonb_build_object('success', true, 'months', k.months, 'until', v_end);
END $$;

-- 12) Generar claves (modo dios) ---------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_generate_license_keys(p_months int, p_count int, p_note text DEFAULT NULL)
RETURNS SETOF public.license_keys LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions' AS $$
DECLARE
    -- Sin caracteres ambiguos (0/O, 1/I/L)
    alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    v_key text;
    i int;
    b bytea;
    n int := 0;
BEGIN
    IF NOT public.is_god_mode() THEN RAISE EXCEPTION 'Solo modo dios' USING ERRCODE = '42501'; END IF;
    IF p_months NOT IN (3, 6, 12) THEN RAISE EXCEPTION 'La vigencia debe ser de 3, 6 o 12 meses'; END IF;
    IF p_count < 1 OR p_count > 500 THEN RAISE EXCEPTION 'Genera entre 1 y 500 claves'; END IF;
    WHILE n < p_count LOOP
        b := gen_random_bytes(12);
        v_key := '';
        FOR i IN 0..11 LOOP
            v_key := v_key || substr(alphabet, (get_byte(b, i) % length(alphabet)) + 1, 1);
        END LOOP;
        BEGIN
            RETURN QUERY INSERT INTO license_keys (key, months, note) VALUES (v_key, p_months, nullif(trim(p_note), '')) RETURNING *;
            n := n + 1;
        EXCEPTION WHEN unique_violation THEN
            -- colisión (muy improbable): se intenta otra
        END;
    END LOOP;
END $$;

-- 13) Avisos diarios ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.billing_queue_notice(p_tenant uuid, p_kind text, p_payload jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
    -- Un aviso por tipo y periodo
    UPDATE space_subscriptions SET notices = notices || jsonb_build_object(p_kind, now()) WHERE tenant_id = p_tenant;
    INSERT INTO billing_notices (tenant_id, kind, email, name, payload)
    SELECT p_tenant, p_kind, p.email, coalesce(nullif(trim(concat_ws(' ', pt.first_name, pt.last_name_paternal)), ''), p.full_name),
           p_payload || jsonb_build_object('space', t.name, 'tenant_type', t.type)
    FROM profile_tenants pt
    JOIN profiles p ON p.id = pt.profile_id
    JOIN tenants t ON t.id = pt.tenant_id
    WHERE pt.tenant_id = p_tenant AND p.email IS NOT NULL
      AND (t.type = 'INDEPENDENT' OR upper(pt.role) IN ('DIRECTOR', 'ADMIN'));
    INSERT INTO billing_events (tenant_id, kind, detail) VALUES (p_tenant, 'NOTICE', jsonb_build_object('notice', p_kind));
END $$;
REVOKE EXECUTE ON FUNCTION public.billing_queue_notice(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.billing_daily()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
    s record;
    v_days int;
    n int := 0;
BEGIN
    FOR s IN SELECT * FROM space_subscriptions LOOP
        IF s.status = 'TRIAL' AND s.trial_ends_at IS NOT NULL THEN
            v_days := ceil(extract(epoch FROM (s.trial_ends_at - now())) / 86400)::int;
            IF v_days <= 0 THEN
                UPDATE space_subscriptions SET status = 'EXPIRED', updated_at = now() WHERE tenant_id = s.tenant_id;
                IF NOT s.notices ? 'TRIAL_ENDED' THEN PERFORM billing_queue_notice(s.tenant_id, 'TRIAL_ENDED', jsonb_build_object('ends_at', s.trial_ends_at)); n := n + 1; END IF;
            ELSIF v_days <= 1 AND NOT s.notices ? 'TRIAL_1D' THEN
                PERFORM billing_queue_notice(s.tenant_id, 'TRIAL_1D', jsonb_build_object('ends_at', s.trial_ends_at, 'days', v_days)); n := n + 1;
            ELSIF v_days <= 7 AND NOT s.notices ? 'TRIAL_7D' THEN
                PERFORM billing_queue_notice(s.tenant_id, 'TRIAL_7D', jsonb_build_object('ends_at', s.trial_ends_at, 'days', v_days)); n := n + 1;
            END IF;
        ELSIF s.status IN ('ACTIVE', 'CANCELED') AND s.current_period_end IS NOT NULL THEN
            v_days := ceil(extract(epoch FROM (s.current_period_end - now())) / 86400)::int;
            IF v_days <= 0 THEN
                UPDATE space_subscriptions SET status = 'EXPIRED', auto_renew = false, updated_at = now() WHERE tenant_id = s.tenant_id;
                IF NOT s.notices ? 'EXPIRED' THEN PERFORM billing_queue_notice(s.tenant_id, 'EXPIRED', jsonb_build_object('ends_at', s.current_period_end)); n := n + 1; END IF;
            ELSIF NOT s.auto_renew THEN
                -- Solo si NO hay cobro automático se avisa la caducidad
                IF v_days <= 1 AND NOT s.notices ? 'RENEW_1D' THEN
                    PERFORM billing_queue_notice(s.tenant_id, 'RENEW_1D', jsonb_build_object('ends_at', s.current_period_end, 'days', v_days, 'plan', s.plan)); n := n + 1;
                ELSIF v_days <= 7 AND NOT s.notices ? 'RENEW_7D' THEN
                    PERFORM billing_queue_notice(s.tenant_id, 'RENEW_7D', jsonb_build_object('ends_at', s.current_period_end, 'days', v_days, 'plan', s.plan)); n := n + 1;
                END IF;
            END IF;
        ELSIF s.status = 'PAST_DUE' AND s.current_period_end + interval '3 days' <= now() THEN
            UPDATE space_subscriptions SET status = 'EXPIRED', auto_renew = false, updated_at = now() WHERE tenant_id = s.tenant_id;
            IF NOT s.notices ? 'EXPIRED' THEN PERFORM billing_queue_notice(s.tenant_id, 'EXPIRED', jsonb_build_object('ends_at', s.current_period_end)); n := n + 1; END IF;
        END IF;
    END LOOP;
    RETURN n;
END $$;
REVOKE EXECUTE ON FUNCTION public.billing_daily() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.space_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.billing_quote(text, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.redeem_license_key(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_generate_license_keys(int, int, text) TO authenticated;

-- 14) Tarea diaria: calcular avisos y enviar correos (8:05 am hora del centro de México)
CREATE OR REPLACE FUNCTION private.billing_daily_tick()
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE
    v_secret text;
    v_base   text;
BEGIN
    PERFORM public.billing_daily();
    SELECT value INTO v_secret FROM private.app_secrets WHERE name = 'cron_secret';
    SELECT value INTO v_base   FROM private.app_secrets WHERE name = 'functions_base_url';
    IF v_base IS NULL THEN RETURN NULL; END IF;
    RETURN net.http_post(
        url := v_base || '/billing-notify',
        body := '{}'::jsonb,
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
        timeout_milliseconds := 60000
    );
END $$;

DO $$
BEGIN
    PERFORM cron.unschedule('billing-daily') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'billing-daily');
    PERFORM cron.schedule('billing-daily', '5 14 * * *', 'SELECT private.billing_daily_tick()');
END $$;

-- 15) Funciones internas: solo el servidor (service role) las usa
GRANT EXECUTE ON FUNCTION public.billing_extend(uuid, int, text, text, numeric, jsonb, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.billing_queue_notice(uuid, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.billing_daily() TO service_role;
GRANT EXECUTE ON FUNCTION public.billing_quote(text, text) TO service_role;

-- 16) Contador de usos de códigos promocionales
CREATE OR REPLACE FUNCTION public.billing_count_promo_use(p_code text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
    UPDATE promo_codes SET uses = uses + 1 WHERE code = upper(p_code)
$$;
REVOKE EXECUTE ON FUNCTION public.billing_count_promo_use(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.billing_count_promo_use(text) TO service_role;
