-- Escuelas: la anualidad depende del número de usuarios → se cotiza con ventas.
-- Los docentes independientes contratan en línea (mensual $75 / anual $700).
CREATE TABLE IF NOT EXISTS public.sales_leads (
    id           bigserial PRIMARY KEY,
    tenant_id    uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
    user_id      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    contact_name text NOT NULL,
    email        text NOT NULL,
    phone        text,
    users_count  integer CHECK (users_count IS NULL OR users_count > 0),
    message      text,
    status       text NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'CONTACTED', 'WON', 'LOST')),
    notes        text,
    created_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sales_leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "God manages sales leads" ON public.sales_leads;
CREATE POLICY "God manages sales leads" ON public.sales_leads FOR ALL TO authenticated USING (public.is_god_mode()) WITH CHECK (public.is_god_mode());
DROP POLICY IF EXISTS "Members read own leads" ON public.sales_leads;
CREATE POLICY "Members read own leads" ON public.sales_leads FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.request_sales_quote(p_name text, p_phone text, p_users int, p_message text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
    v_tenant uuid := public.get_current_tenant_id();
    v_email text;
    v_sales text;
    v_space text;
    v_id bigint;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Inicia sesión'; END IF;
    IF nullif(trim(coalesce(p_name, '')), '') IS NULL THEN RAISE EXCEPTION 'Escribe tu nombre'; END IF;
    IF (SELECT count(*) FROM sales_leads WHERE user_id = auth.uid() AND created_at > now() - interval '1 day') >= 3 THEN
        RAISE EXCEPTION 'Ya recibimos tu solicitud; ventas te contactará pronto.';
    END IF;
    SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
    SELECT name INTO v_space FROM tenants WHERE id = v_tenant;
    INSERT INTO sales_leads (tenant_id, user_id, contact_name, email, phone, users_count, message)
    VALUES (v_tenant, auth.uid(), left(trim(p_name), 120), v_email, left(nullif(trim(coalesce(p_phone, '')), ''), 30),
            p_users, left(nullif(trim(coalesce(p_message, '')), ''), 1000))
    RETURNING id INTO v_id;
    INSERT INTO billing_events (tenant_id, user_id, kind, detail) VALUES (v_tenant, auth.uid(), 'SALES_LEAD', jsonb_build_object('lead_id', v_id, 'users', p_users));

    -- Aviso por correo al equipo de ventas (system_settings.sales_email)
    SELECT nullif(trim(value), '') INTO v_sales FROM system_settings WHERE key = 'sales_email';
    IF v_sales IS NOT NULL AND v_tenant IS NOT NULL THEN
        INSERT INTO billing_notices (tenant_id, kind, email, name, payload)
        VALUES (v_tenant, 'SALES_LEAD', v_sales, 'Ventas', jsonb_build_object(
            'space', v_space, 'contact', trim(p_name), 'contact_email', v_email, 'phone', p_phone, 'users', p_users, 'message', p_message));
    END IF;
    RETURN jsonb_build_object('success', true, 'id', v_id);
END $$;
REVOKE EXECUTE ON FUNCTION public.request_sales_quote(text, text, int, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_sales_quote(text, text, int, text) TO authenticated;
