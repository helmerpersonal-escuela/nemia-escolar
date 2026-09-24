-- Registro de errores del navegador (auditoría 24/09/2026).
-- Cualquiera puede INSERTAR (incluye pantallas sin sesión) con tamaños acotados;
-- solo el super admin puede leer. Se purga a los 30 días.
CREATE TABLE IF NOT EXISTS public.client_errors (
    id          bigserial PRIMARY KEY,
    created_at  timestamptz NOT NULL DEFAULT now(),
    user_id     uuid DEFAULT auth.uid(),
    kind        text NOT NULL DEFAULT 'manual',
    message     text NOT NULL,
    stack       text,
    url         text,
    user_agent  text,
    app_version text,
    extra       jsonb
);
CREATE INDEX IF NOT EXISTS client_errors_created_idx ON public.client_errors (created_at DESC);
ALTER TABLE public.client_errors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can report client errors" ON public.client_errors;
CREATE POLICY "Anyone can report client errors" ON public.client_errors
    FOR INSERT TO anon, authenticated
    WITH CHECK (
        kind IN ('render', 'window', 'promise', 'manual')
        AND length(message) <= 1000
        AND coalesce(length(stack), 0) <= 6000
        AND coalesce(length(url), 0) <= 300
        AND coalesce(length(user_agent), 0) <= 300
        AND coalesce(length(extra::text), 0) <= 2500
        AND (user_id IS NULL OR user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Super admin reads client errors" ON public.client_errors;
CREATE POLICY "Super admin reads client errors" ON public.client_errors
    FOR SELECT TO authenticated USING (public.is_god_mode());

GRANT INSERT ON public.client_errors TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.client_errors_id_seq TO anon, authenticated;

DO $$
BEGIN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'client-errors-purge';
    PERFORM cron.schedule('client-errors-purge', '30 9 * * *',
        $cmd$DELETE FROM public.client_errors WHERE created_at < now() - interval '30 days'$cmd$);
END $$;

-- Resumen para revisar en producción (super admin): errores más frecuentes de 7 días.
CREATE OR REPLACE FUNCTION public.client_errors_summary(p_days integer DEFAULT 7)
RETURNS TABLE (message text, kind text, total bigint, users bigint, last_seen timestamptz, sample_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT e.message, e.kind, count(*), count(DISTINCT e.user_id), max(e.created_at), max(e.url)
    FROM public.client_errors e
    WHERE public.is_god_mode() AND e.created_at > now() - make_interval(days => p_days)
    GROUP BY e.message, e.kind
    ORDER BY count(*) DESC
    LIMIT 50;
$$;
REVOKE ALL ON FUNCTION public.client_errors_summary(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_errors_summary(integer) TO authenticated;
