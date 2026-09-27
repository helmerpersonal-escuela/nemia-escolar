-- Límites de IA por docente y resumen de consumo para modo dios
ALTER TABLE public.ai_usage ADD COLUMN IF NOT EXISTS out_chars integer;

INSERT INTO public.system_settings (key, value, description) VALUES
    ('ai_daily_limit', '30', 'Solicitudes de IA por usuario en 24 horas'),
    ('ai_daily_char_limit', '250000', 'Caracteres enviados a la IA por usuario en 24 horas (~62 mil tokens)')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description, updated_at = now();

CREATE OR REPLACE FUNCTION public.admin_ai_usage_summary(p_days int DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
    v_since timestamptz := now() - make_interval(days => greatest(1, least(p_days, 365)));
BEGIN
    IF NOT public.is_god_mode() THEN RAISE EXCEPTION 'Solo modo dios' USING ERRCODE = '42501'; END IF;
    RETURN jsonb_build_object(
        'days', p_days,
        'totals', (SELECT jsonb_build_object('requests', count(*), 'users', count(DISTINCT user_id),
                        'in_chars', coalesce(sum(chars), 0), 'out_chars', coalesce(sum(out_chars), 0))
                   FROM ai_usage WHERE created_at >= v_since),
        'by_provider', (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM (
                        SELECT provider, count(*) AS requests, coalesce(sum(chars), 0) AS in_chars, coalesce(sum(out_chars), 0) AS out_chars
                        FROM ai_usage WHERE created_at >= v_since GROUP BY provider ORDER BY 2 DESC) x),
        'top_users', (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM (
                        SELECT u.user_id, coalesce(p.full_name, p.email) AS name, count(*) AS requests,
                               coalesce(sum(u.chars), 0) AS in_chars, coalesce(sum(u.out_chars), 0) AS out_chars,
                               max(cnt_day) AS max_day
                        FROM ai_usage u
                        LEFT JOIN profiles p ON p.id = u.user_id
                        LEFT JOIN LATERAL (SELECT count(*) AS cnt_day FROM ai_usage d
                                           WHERE d.user_id = u.user_id AND d.created_at >= v_since
                                           GROUP BY date_trunc('day', d.created_at) ORDER BY 1 DESC LIMIT 1) m ON true
                        WHERE u.created_at >= v_since
                        GROUP BY u.user_id, p.full_name, p.email ORDER BY 3 DESC LIMIT 15) x));
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_ai_usage_summary(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_ai_usage_summary(int) TO authenticated;
