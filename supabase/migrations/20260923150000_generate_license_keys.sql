-- God Mode llamaba a generate_license_keys() pero la función nunca existió.
-- Genera códigos de licencia canjeables. Solo Super Admin.
CREATE OR REPLACE FUNCTION public.generate_license_keys(p_count integer, p_plan_type text, p_duration_days integer)
RETURNS SETOF text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  i integer;
  v_code text;
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
BEGIN
  IF NOT public.is_god_mode() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  IF p_count IS NULL OR p_count < 1 OR p_count > 500 THEN
    RAISE EXCEPTION 'Cantidad inválida (1-500)';
  END IF;
  IF lower(coalesce(p_plan_type, '')) NOT IN ('basic', 'pro') THEN
    RAISE EXCEPTION 'Plan inválido';
  END IF;
  IF p_duration_days IS NULL OR p_duration_days < 1 OR p_duration_days > 1095 THEN
    RAISE EXCEPTION 'Duración inválida (1-1095 días)';
  END IF;

  FOR i IN 1..p_count LOOP
    LOOP
      -- VNK-XXXX-XXXX-XXXX con bytes aleatorios criptográficos
      SELECT 'VNK-' || string_agg(
               substr(v_alphabet, (get_byte(b, n) % length(v_alphabet)) + 1, 1)
               || CASE WHEN n IN (3, 7) THEN '-' ELSE '' END, '' ORDER BY n)
        INTO v_code
        FROM (SELECT gen_random_bytes(12) AS b) r, generate_series(0, 11) AS n;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.license_keys WHERE code = v_code);
    END LOOP;

    INSERT INTO public.license_keys (code, plan_type, duration_days, status, created_by)
    VALUES (v_code, lower(p_plan_type), p_duration_days, 'active', auth.uid());
    RETURN NEXT v_code;
  END LOOP;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.generate_license_keys(integer, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_license_keys(integer, text, integer) TO authenticated;
