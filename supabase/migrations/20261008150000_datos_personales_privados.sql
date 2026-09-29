-- Datos personales del personal fuera de `profiles`.
-- `profiles` lo leen compañeros de la escuela (nombres en listas, chat, horarios).
-- CURP, RFC, domicilio, teléfono, fecha de nacimiento, sexo, estado civil y
-- nacionalidad pasan a `profile_private`, que solo ve:
--   * la propia persona;
--   * dirección, administración o control escolar de una escuela donde esa persona trabaja;
--   * super admin.
-- Un trigger en `profiles` manda ahí cualquier dato sensible que se intente guardar,
-- así el código que ya escribía en `profiles` sigue funcionando.

CREATE TABLE IF NOT EXISTS public.profile_private (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  nationality text,
  birth_date date,
  sex text,
  marital_status text,
  curp text,
  rfc text,
  address_particular text,
  phone_contact text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profile_private ENABLE ROW LEVEL SECURITY;

-- ¿Puedo ver los datos privados de p_profile?
CREATE OR REPLACE FUNCTION public.can_view_private_profile(p_profile uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT auth.uid() IS NOT NULL AND (
    p_profile = auth.uid()
    OR public.is_god_mode()
    OR EXISTS (
      SELECT 1 FROM public.profile_tenants viewer
        JOIN public.profile_tenants target ON target.tenant_id = viewer.tenant_id
       WHERE viewer.profile_id = auth.uid()
         AND upper(viewer.role) IN ('DIRECTOR', 'ADMIN', 'SCHOOL_CONTROL')
         AND target.profile_id = p_profile)
  );
$$;
REVOKE ALL ON FUNCTION public.can_view_private_profile(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_private_profile(uuid) TO authenticated;

DROP POLICY IF EXISTS profile_private_select ON public.profile_private;
DROP POLICY IF EXISTS profile_private_own ON public.profile_private;
CREATE POLICY profile_private_select ON public.profile_private FOR SELECT TO authenticated
  USING (public.can_view_private_profile(profile_id));
CREATE POLICY profile_private_own ON public.profile_private FOR ALL TO authenticated
  USING (profile_id = auth.uid() OR public.is_god_mode())
  WITH CHECK (profile_id = auth.uid() OR public.is_god_mode());

-- Pasar lo que ya exista y vaciar las columnas de profiles
INSERT INTO public.profile_private (profile_id, nationality, birth_date, sex, marital_status, curp, rfc, address_particular, phone_contact)
SELECT id, nationality, birth_date, sex, marital_status, curp, rfc, address_particular, phone_contact
  FROM public.profiles
 WHERE coalesce(nationality, sex, marital_status, curp, rfc, address_particular, phone_contact) IS NOT NULL
    OR birth_date IS NOT NULL
ON CONFLICT (profile_id) DO NOTHING;

UPDATE public.profiles
   SET nationality = NULL, birth_date = NULL, sex = NULL, marital_status = NULL,
       curp = NULL, rfc = NULL, address_particular = NULL, phone_contact = NULL
 WHERE coalesce(nationality, sex, marital_status, curp, rfc, address_particular, phone_contact) IS NOT NULL
    OR birth_date IS NOT NULL;

-- Todo dato sensible que llegue a profiles se guarda en profile_private
CREATE OR REPLACE FUNCTION public.profiles_move_private()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF coalesce(NEW.nationality, NEW.sex, NEW.marital_status, NEW.curp, NEW.rfc, NEW.address_particular, NEW.phone_contact) IS NOT NULL
     OR NEW.birth_date IS NOT NULL THEN
    INSERT INTO public.profile_private AS pp (profile_id, nationality, birth_date, sex, marital_status, curp, rfc, address_particular, phone_contact, updated_at)
    VALUES (NEW.id, NEW.nationality, NEW.birth_date, NEW.sex, NEW.marital_status, NEW.curp, NEW.rfc, NEW.address_particular, NEW.phone_contact, now())
    ON CONFLICT (profile_id) DO UPDATE SET
      nationality = coalesce(EXCLUDED.nationality, pp.nationality),
      birth_date = coalesce(EXCLUDED.birth_date, pp.birth_date),
      sex = coalesce(EXCLUDED.sex, pp.sex),
      marital_status = coalesce(EXCLUDED.marital_status, pp.marital_status),
      curp = coalesce(EXCLUDED.curp, pp.curp),
      rfc = coalesce(EXCLUDED.rfc, pp.rfc),
      address_particular = coalesce(EXCLUDED.address_particular, pp.address_particular),
      phone_contact = coalesce(EXCLUDED.phone_contact, pp.phone_contact),
      updated_at = now();
    NEW.nationality := NULL; NEW.birth_date := NULL; NEW.sex := NULL; NEW.marital_status := NULL;
    NEW.curp := NULL; NEW.rfc := NULL; NEW.address_particular := NULL; NEW.phone_contact := NULL;
  END IF;
  RETURN NEW;
END $$;

-- Nombre con "zz" para que corra después de las validaciones existentes
DROP TRIGGER IF EXISTS tr_zz_profiles_move_private ON public.profiles;
CREATE TRIGGER tr_zz_profiles_move_private BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_move_private();
