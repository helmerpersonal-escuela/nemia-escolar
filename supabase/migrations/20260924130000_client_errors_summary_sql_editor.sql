-- Permite usar el resumen desde el SQL Editor de Supabase (sesión "postgres"),
-- además de super admin desde la app.
CREATE OR REPLACE FUNCTION public.client_errors_summary(p_days integer DEFAULT 7)
RETURNS TABLE (message text, kind text, total bigint, users bigint, last_seen timestamptz, sample_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT e.message, e.kind, count(*), count(DISTINCT e.user_id), max(e.created_at), max(e.url)
    FROM public.client_errors e
    WHERE (public.is_god_mode() OR session_user = 'postgres')
      AND e.created_at > now() - make_interval(days => p_days)
    GROUP BY e.message, e.kind
    ORDER BY count(*) DESC
    LIMIT 50;
$$;
REVOKE ALL ON FUNCTION public.client_errors_summary(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_errors_summary(integer) TO authenticated;
