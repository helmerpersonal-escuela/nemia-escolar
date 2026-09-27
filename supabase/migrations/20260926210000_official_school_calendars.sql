-- Calendario escolar oficial de la SEP. La app lo consulta (con conexión) para
-- prellenar nombre, inicio y fin del ciclo escolar; el usuario puede cambiarlos.
-- Fuente 2026-2027: https://educacionbasica.sep.gob.mx/publica-sep-calendario-escolar-2026-2027-para-educacion-basica-y-normal/
CREATE TABLE IF NOT EXISTS public.official_school_calendars (
    school_year   text NOT NULL,
    level         text NOT NULL DEFAULT 'BASICA' CHECK (level IN ('BASICA', 'NORMAL')),
    name          text NOT NULL,
    start_date    date NOT NULL,
    end_date      date NOT NULL,
    school_days   integer,
    source_url    text,
    published_at  date,
    updated_at    timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (school_year, level),
    CHECK (end_date > start_date)
);
COMMENT ON TABLE public.official_school_calendars IS 'Calendario escolar oficial de la SEP (inicio y fin de clases por ciclo). La app lo usa para prellenar el ciclo escolar; el usuario puede cambiarlo.';
ALTER TABLE public.official_school_calendars ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Everyone reads official calendars" ON public.official_school_calendars;
CREATE POLICY "Everyone reads official calendars" ON public.official_school_calendars FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Super admin manages official calendars" ON public.official_school_calendars;
CREATE POLICY "Super admin manages official calendars" ON public.official_school_calendars FOR ALL TO authenticated USING (public.is_god_mode()) WITH CHECK (public.is_god_mode());
GRANT SELECT ON public.official_school_calendars TO anon, authenticated;

INSERT INTO public.official_school_calendars (school_year, level, name, start_date, end_date, school_days, source_url, published_at) VALUES
 ('2026-2027', 'BASICA', 'CICLO 2026-2027', '2026-08-31', '2027-07-09', 185, 'https://educacionbasica.sep.gob.mx/publica-sep-calendario-escolar-2026-2027-para-educacion-basica-y-normal/', NULL),
 ('2026-2027', 'NORMAL', 'CICLO 2026-2027', '2026-08-31', '2027-07-13', 190, 'https://educacionbasica.sep.gob.mx/publica-sep-calendario-escolar-2026-2027-para-educacion-basica-y-normal/', NULL)
ON CONFLICT (school_year, level) DO UPDATE SET name = EXCLUDED.name, start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date, school_days = EXCLUDED.school_days, source_url = EXCLUDED.source_url, updated_at = now();
