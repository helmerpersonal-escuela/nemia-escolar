-- Piloto en escuelas: registro automático y silencioso de errores y fricciones.
-- 1) Faltaba la política de INSERT en producción: ningún error se estaba guardando.
-- 2) Más contexto (escuela, rol, plataforma, huella para agrupar) y nuevos tipos.
-- 3) Tabla de seguimiento para marcar cada problema como revisado/corregido.

ALTER TABLE public.client_errors
    ADD COLUMN IF NOT EXISTS tenant_id   uuid,
    ADD COLUMN IF NOT EXISTS role        text,
    ADD COLUMN IF NOT EXISTS platform    text,
    ADD COLUMN IF NOT EXISTS fingerprint text;

CREATE INDEX IF NOT EXISTS client_errors_fp_idx ON public.client_errors (fingerprint, created_at DESC);

DROP POLICY IF EXISTS "Anyone can report client errors" ON public.client_errors;
CREATE POLICY "Anyone can report client errors" ON public.client_errors
    FOR INSERT TO anon, authenticated
    WITH CHECK (
        kind IN ('render', 'window', 'promise', 'manual', 'api', 'query', 'alert', 'console', 'ux')
        AND length(message) <= 1000
        AND coalesce(length(stack), 0) <= 6000
        AND coalesce(length(url), 0) <= 300
        AND coalesce(length(user_agent), 0) <= 300
        AND coalesce(length(extra::text), 0) <= 4000
        AND coalesce(length(role), 0) <= 40
        AND coalesce(length(platform), 0) <= 20
        AND coalesce(length(fingerprint), 0) <= 300
        AND (user_id IS NULL OR user_id = auth.uid())
    );

GRANT INSERT ON public.client_errors TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.client_errors_id_seq TO anon, authenticated;

-- Seguimiento (solo super admin)
CREATE TABLE IF NOT EXISTS public.client_issue_status (
    fingerprint text PRIMARY KEY,
    status      text NOT NULL DEFAULT 'nuevo' CHECK (status IN ('nuevo', 'revisando', 'corregido', 'ignorar')),
    notes       text,
    updated_at  timestamptz NOT NULL DEFAULT now(),
    updated_by  uuid DEFAULT auth.uid()
);
ALTER TABLE public.client_issue_status ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Super admin manages issue status" ON public.client_issue_status;
CREATE POLICY "Super admin manages issue status" ON public.client_issue_status
    FOR ALL TO authenticated USING (public.is_god_mode()) WITH CHECK (public.is_god_mode());

-- Resumen agrupado por problema (huella)
DROP FUNCTION IF EXISTS public.client_issues(integer);
CREATE OR REPLACE FUNCTION public.client_issues(p_days integer DEFAULT 30)
RETURNS TABLE(fingerprint text, kind text, message text, total bigint, users bigint, schools bigint,
              first_seen timestamptz, last_seen timestamptz, sample_url text, roles text, platforms text,
              status text, notes text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
    SELECT coalesce(e.fingerprint, e.kind || ':' || left(e.message, 120)) AS fp,
           min(e.kind), min(e.message), count(*), count(DISTINCT e.user_id), count(DISTINCT e.tenant_id),
           min(e.created_at), max(e.created_at), max(e.url),
           string_agg(DISTINCT e.role, ', '), string_agg(DISTINCT e.platform, ', '),
           coalesce(max(s.status), 'nuevo'), max(s.notes)
    FROM public.client_errors e
    LEFT JOIN public.client_issue_status s ON s.fingerprint = coalesce(e.fingerprint, e.kind || ':' || left(e.message, 120))
    WHERE (public.is_god_mode() OR session_user = 'postgres')
      AND e.created_at > now() - make_interval(days => p_days)
    GROUP BY 1
    ORDER BY max(e.created_at) DESC
    LIMIT 300;
$$;
REVOKE ALL ON FUNCTION public.client_issues(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_issues(integer) TO authenticated;

-- Durante el piloto se conservan 90 días.
DO $$
BEGIN
    PERFORM cron.unschedule('client-errors-purge');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
SELECT cron.schedule('client-errors-purge', '30 9 * * *',
    $cmd$DELETE FROM public.client_errors WHERE created_at < now() - interval '90 days'$cmd$);
