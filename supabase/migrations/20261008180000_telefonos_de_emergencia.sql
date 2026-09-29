-- Cada madre/padre/tutor: un teléfono principal y dos de respaldo para emergencias.
ALTER TABLE public.guardians ADD COLUMN IF NOT EXISTS phone_alt1 text;
ALTER TABLE public.guardians ADD COLUMN IF NOT EXISTS phone_alt2 text;
ALTER TABLE public.guardians ADD COLUMN IF NOT EXISTS phones_confirmed_at timestamptz;
COMMENT ON COLUMN public.guardians.phone IS 'Teléfono principal (obligatorio, 10 dígitos)';
COMMENT ON COLUMN public.guardians.phone_alt1 IS 'Teléfono de respaldo 1';
COMMENT ON COLUMN public.guardians.phone_alt2 IS 'Teléfono de respaldo 2';

-- La familia no puede escribir en guardians (RLS); confirma o corrige sus teléfonos con esta función.
CREATE OR REPLACE FUNCTION public.update_my_contact_phones(p_phone text, p_alt1 text DEFAULT NULL, p_alt2 text DEFAULT NULL)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_main text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_a1 text := nullif(regexp_replace(coalesce(p_alt1, ''), '\D', '', 'g'), '');
  v_a2 text := nullif(regexp_replace(coalesce(p_alt2, ''), '\D', '', 'g'), '');
  n int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sesión requerida' USING errcode = '42501'; END IF;
  IF length(v_main) <> 10 THEN RAISE EXCEPTION 'El teléfono principal debe tener 10 dígitos'; END IF;
  IF (v_a1 IS NOT NULL AND length(v_a1) <> 10) OR (v_a2 IS NOT NULL AND length(v_a2) <> 10) THEN
    RAISE EXCEPTION 'Los teléfonos de respaldo deben tener 10 dígitos';
  END IF;
  UPDATE public.guardians
     SET phone = v_main, phone_alt1 = v_a1, phone_alt2 = v_a2, phones_confirmed_at = now()
   WHERE user_id = auth.uid() OR profile_id = auth.uid();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.update_my_contact_phones(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_my_contact_phones(text, text, text) TO authenticated;
