-- =====================================================================
-- Libros de texto (catálogo CONALITEG + texto por página) y CTE
-- (sesiones, insumos, acuerdos, propuestas IA) + corrección de RLS PEMC
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Utilidades privadas: secretos internos y verificación
-- ---------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.app_secrets (
    name  text PRIMARY KEY,
    value text NOT NULL
);
REVOKE ALL ON private.app_secrets FROM PUBLIC, anon, authenticated;

INSERT INTO private.app_secrets (name, value)
VALUES ('cron_secret', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
ON CONFLICT (name) DO NOTHING;

INSERT INTO private.app_secrets (name, value)
VALUES ('functions_base_url', 'https://xgrwivblrrucucjhrmni.supabase.co/functions/v1')
ON CONFLICT (name) DO NOTHING;

-- Solo el service_role (Edge Functions) puede validar el secreto del cron.
CREATE OR REPLACE FUNCTION public.verify_cron_secret(p_secret text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT coalesce(p_secret, '') <> ''
       AND EXISTS (SELECT 1 FROM private.app_secrets WHERE name = 'cron_secret' AND value = p_secret);
$$;
REVOKE ALL ON FUNCTION public.verify_cron_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_cron_secret(text) TO service_role;

-- ---------------------------------------------------------------------
-- 1. Libros de texto: catálogo oficial sincronizado
-- ---------------------------------------------------------------------
ALTER TABLE public.textbooks
    ADD COLUMN IF NOT EXISTS clave           text,
    ADD COLUMN IF NOT EXISTS ciclo           integer,
    ADD COLUMN IF NOT EXISTS grades          integer[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS field_code      text,
    ADD COLUMN IF NOT EXISTS source          text NOT NULL DEFAULT 'CONALITEG',
    ADD COLUMN IF NOT EXISTS reader_url      text,
    ADD COLUMN IF NOT EXISTS etag            text,
    ADD COLUMN IF NOT EXISTS last_modified   text,
    ADD COLUMN IF NOT EXISTS size_bytes      bigint,
    ADD COLUMN IF NOT EXISTS page_count      integer,
    ADD COLUMN IF NOT EXISTS text_status     text NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS text_pages_done integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS text_error      text,
    ADD COLUMN IF NOT EXISTS text_updated_at timestamptz,
    ADD COLUMN IF NOT EXISTS is_current      boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS synced_at       timestamptz;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'textbooks_text_status_check') THEN
        ALTER TABLE public.textbooks ADD CONSTRAINT textbooks_text_status_check
            CHECK (text_status IN ('pending', 'processing', 'done', 'error', 'no_text'));
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS textbooks_clave_ciclo_key ON public.textbooks (clave, ciclo);
CREATE INDEX IF NOT EXISTS textbooks_level_grade_idx ON public.textbooks (level, grade) WHERE is_current;
CREATE INDEX IF NOT EXISTS textbooks_grades_idx ON public.textbooks USING gin (grades);

-- Texto por página (solo texto: el PDF se abre desde CONALITEG)
CREATE TABLE IF NOT EXISTS public.textbook_pages (
    textbook_id uuid    NOT NULL REFERENCES public.textbooks(id) ON DELETE CASCADE,
    page        integer NOT NULL,
    content     text    NOT NULL DEFAULT '',
    fts         tsvector GENERATED ALWAYS AS (to_tsvector('spanish', coalesce(content, ''))) STORED,
    PRIMARY KEY (textbook_id, page)
);
CREATE INDEX IF NOT EXISTS textbook_pages_fts_idx ON public.textbook_pages USING gin (fts);
ALTER TABLE public.textbook_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read textbook pages" ON public.textbook_pages;
CREATE POLICY "Authenticated read textbook pages" ON public.textbook_pages
    FOR SELECT TO authenticated USING (true);
-- Escritura: solo service_role (Edge Function de sincronización), que omite RLS.

-- Administración manual del catálogo: solo super admin (antes: correo fijo en JWT)
DROP POLICY IF EXISTS "Allow superadmins to manage textbooks" ON public.textbooks;
CREATE POLICY "Super admin manages textbooks" ON public.textbooks
    FOR ALL TO authenticated
    USING (public.is_god_mode())
    WITH CHECK (public.is_god_mode());

-- Búsqueda de texto completo en los libros vigentes
CREATE OR REPLACE FUNCTION public.search_textbook_pages(
    p_query text,
    p_level text DEFAULT NULL,
    p_grade integer DEFAULT NULL,
    p_textbook uuid DEFAULT NULL,
    p_limit integer DEFAULT 10
)
RETURNS TABLE (
    textbook_id uuid,
    title text,
    level text,
    grade integer,
    field_of_study text,
    page integer,
    snippet text,
    rank real
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
    WITH q AS (SELECT websearch_to_tsquery('spanish', coalesce(p_query, '')) AS tsq)
    SELECT t.id, t.title, t.level, t.grade, t.field_of_study, p.page,
           ts_headline('spanish', p.content, q.tsq,
                       'MaxWords=40, MinWords=15, MaxFragments=2, StartSel=«, StopSel=»') AS snippet,
           ts_rank(p.fts, q.tsq) AS rank
    FROM q
    JOIN public.textbook_pages p ON p.fts @@ q.tsq
    JOIN public.textbooks t ON t.id = p.textbook_id
    WHERE t.is_current
      AND (p_level IS NULL OR t.level = upper(p_level))
      AND (p_grade IS NULL OR t.grade = p_grade OR p_grade = ANY (t.grades))
      AND (p_textbook IS NULL OR t.id = p_textbook)
    ORDER BY rank DESC
    LIMIT least(greatest(coalesce(p_limit, 10), 1), 50);
$$;
GRANT EXECUTE ON FUNCTION public.search_textbook_pages(text, text, integer, uuid, integer) TO authenticated;

-- Texto de un rango de páginas (máx. 60) para planeación / IA
CREATE OR REPLACE FUNCTION public.get_textbook_text(p_textbook uuid, p_from integer, p_to integer)
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
    SELECT string_agg(format(E'--- Página %s ---\n%s', page, content), E'\n\n' ORDER BY page)
    FROM public.textbook_pages
    WHERE textbook_id = p_textbook
      AND page BETWEEN greatest(p_from, 1) AND least(p_to, greatest(p_from, 1) + 59);
$$;
GRANT EXECUTE ON FUNCTION public.get_textbook_text(uuid, integer, integer) TO authenticated;

-- Storage "textbooks": ya no se guardan libros oficiales; solo subidas personales
-- de docentes en teacher-uploads/<uid>/...
DROP POLICY IF EXISTS "Auth Management" ON storage.objects;
DROP POLICY IF EXISTS "Auth Upload" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;

CREATE POLICY "Textbooks: teachers upload own files" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'textbooks'
        AND (storage.foldername(name))[1] = 'teacher-uploads'
        AND (storage.foldername(name))[2] = auth.uid()::text
    );
CREATE POLICY "Textbooks: teachers manage own files" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'textbooks'
        AND (storage.foldername(name))[1] = 'teacher-uploads'
        AND (storage.foldername(name))[2] = auth.uid()::text
    );
CREATE POLICY "Textbooks: super admin" ON storage.objects
    FOR ALL TO authenticated
    USING (bucket_id = 'textbooks' AND public.is_god_mode())
    WITH CHECK (bucket_id = 'textbooks' AND public.is_god_mode());

-- ---------------------------------------------------------------------
-- 2. Tareas programadas de sincronización
-- ---------------------------------------------------------------------
ALTER TABLE public.textbooks ADD COLUMN IF NOT EXISTS text_lease_until timestamptz;

-- Reserva atómica de un libro para extraer texto (evita ejecuciones solapadas)
CREATE OR REPLACE FUNCTION public.claim_textbook_for_extraction(p_lease_seconds integer DEFAULT 120)
RETURNS SETOF public.textbooks
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE public.textbooks t
       SET text_lease_until = now() + make_interval(secs => p_lease_seconds),
           text_status = 'processing'
     WHERE t.id = (
        SELECT id FROM public.textbooks
         WHERE is_current
           AND text_status IN ('pending', 'processing')
           AND (text_lease_until IS NULL OR text_lease_until < now())
         ORDER BY (text_status = 'processing') DESC, size_bytes NULLS LAST
         LIMIT 1
         FOR UPDATE SKIP LOCKED)
    RETURNING t.*;
$$;
REVOKE ALL ON FUNCTION public.claim_textbook_for_extraction(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_textbook_for_extraction(integer) TO service_role;

CREATE OR REPLACE FUNCTION private.call_textbooks_sync(p_action text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_secret text;
    v_base   text;
BEGIN
    SELECT value INTO v_secret FROM private.app_secrets WHERE name = 'cron_secret';
    SELECT value INTO v_base   FROM private.app_secrets WHERE name = 'functions_base_url';
    RETURN net.http_post(
        url := v_base || '/textbooks-sync',
        body := jsonb_build_object('action', p_action),
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
        timeout_milliseconds := 150000
    );
END;
$$;
REVOKE ALL ON FUNCTION private.call_textbooks_sync(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.textbooks_extract_tick()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.textbooks
               WHERE is_current AND text_status IN ('pending', 'processing')
                 AND (text_lease_until IS NULL OR text_lease_until < now())) THEN
        PERFORM private.call_textbooks_sync('extract');
    END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.textbooks_extract_tick() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
    PERFORM cron.unschedule(jobid) FROM cron.job
     WHERE jobname IN ('textbooks-catalog-sync', 'textbooks-text-extract');
    -- Catálogo: diario 09:15 UTC (03:15 hora del centro de México)
    PERFORM cron.schedule('textbooks-catalog-sync', '15 9 * * *',
                          $cmd$SELECT private.call_textbooks_sync('catalog')$cmd$);
    -- Extracción de texto: cada minuto, solo si hay libros pendientes
    PERFORM cron.schedule('textbooks-text-extract', '* * * * *',
                          $cmd$SELECT private.textbooks_extract_tick()$cmd$);
END $$;

-- ---------------------------------------------------------------------
-- 3. CTE: calendario oficial, sesiones, insumos, acuerdos y propuestas
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.try_uuid(p text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
    SELECT CASE WHEN p ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN p::uuid END;
$$;

CREATE OR REPLACE FUNCTION public.is_cte_manager(p_tenant uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT public.is_god_mode()
        OR coalesce(public.my_role_in_tenant(p_tenant), '') IN ('DIRECTOR', 'ADMIN', 'ACADEMIC_COORD', 'TECH_COORD');
$$;
GRANT EXECUTE ON FUNCTION public.is_cte_manager(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_tenant_member(p_tenant uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT public.is_god_mode() OR public.my_role_in_tenant(p_tenant) IS NOT NULL;
$$;
GRANT EXECUTE ON FUNCTION public.is_tenant_member(uuid) TO authenticated;

-- Calendario oficial SEP (global, solo lectura)
CREATE TABLE IF NOT EXISTS public.cte_calendar (
    school_year    text    NOT NULL,
    session_type   text    NOT NULL CHECK (session_type IN ('INTENSIVA', 'ORDINARIA')),
    session_number integer NOT NULL,
    date           date    NOT NULL,
    PRIMARY KEY (school_year, session_type, session_number)
);
ALTER TABLE public.cte_calendar ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated read cte calendar" ON public.cte_calendar;
CREATE POLICY "Authenticated read cte calendar" ON public.cte_calendar
    FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Super admin manages cte calendar" ON public.cte_calendar;
CREATE POLICY "Super admin manages cte calendar" ON public.cte_calendar
    FOR ALL TO authenticated USING (public.is_god_mode()) WITH CHECK (public.is_god_mode());

INSERT INTO public.cte_calendar (school_year, session_type, session_number, date) VALUES
    ('2026-2027', 'ORDINARIA', 1, '2026-09-25'),
    ('2026-2027', 'ORDINARIA', 2, '2026-10-30'),
    ('2026-2027', 'ORDINARIA', 3, '2026-11-27'),
    ('2026-2027', 'ORDINARIA', 4, '2027-01-29'),
    ('2026-2027', 'ORDINARIA', 5, '2027-02-26'),
    ('2026-2027', 'ORDINARIA', 6, '2027-04-30'),
    ('2026-2027', 'ORDINARIA', 7, '2027-05-28'),
    ('2026-2027', 'ORDINARIA', 8, '2027-06-25')
ON CONFLICT DO NOTHING;

-- Sesiones de cada escuela
CREATE TABLE IF NOT EXISTS public.cte_sessions (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    school_year    text NOT NULL,
    session_type   text NOT NULL DEFAULT 'ORDINARIA'
                   CHECK (session_type IN ('INTENSIVA', 'ORDINARIA', 'EXTRAORDINARIA')),
    session_number integer NOT NULL DEFAULT 0,
    date           date NOT NULL,
    title          text,
    status         text NOT NULL DEFAULT 'PLANNED'
                   CHECK (status IN ('PLANNED', 'AGENDA_READY', 'DONE')),
    agenda         jsonb NOT NULL DEFAULT '[]'::jsonb,
    purpose        text,
    minutes        text,
    official_url   text,
    created_by     uuid DEFAULT auth.uid(),
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, school_year, session_type, session_number)
);
CREATE INDEX IF NOT EXISTS cte_sessions_tenant_date_idx ON public.cte_sessions (tenant_id, date);
ALTER TABLE public.cte_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read cte sessions" ON public.cte_sessions;
CREATE POLICY "Members read cte sessions" ON public.cte_sessions
    FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));
DROP POLICY IF EXISTS "Managers manage cte sessions" ON public.cte_sessions;
CREATE POLICY "Managers manage cte sessions" ON public.cte_sessions
    FOR ALL TO authenticated
    USING (public.is_cte_manager(tenant_id))
    WITH CHECK (public.is_cte_manager(tenant_id));

-- Crea (si faltan) las sesiones del calendario oficial para una escuela
CREATE OR REPLACE FUNCTION public.cte_ensure_sessions(p_tenant uuid, p_school_year text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count integer;
BEGIN
    IF NOT public.is_cte_manager(p_tenant) THEN
        RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
    END IF;
    INSERT INTO public.cte_sessions (tenant_id, school_year, session_type, session_number, date, title, official_url)
    SELECT p_tenant, c.school_year, c.session_type, c.session_number, c.date,
           CASE WHEN c.session_type = 'INTENSIVA' THEN 'Fase intensiva — sesión ' || c.session_number
                ELSE c.session_number || 'ª sesión ordinaria' END,
           'https://gestion.cte.sep.gob.mx/insumos/'
    FROM public.cte_calendar c
    WHERE c.school_year = p_school_year
    ON CONFLICT (tenant_id, school_year, session_type, session_number) DO NOTHING;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.cte_ensure_sessions(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cte_ensure_sessions(uuid, text) TO authenticated;

-- Insumos (guías oficiales, presentaciones, actas, evidencias) con texto extraído
CREATE TABLE IF NOT EXISTS public.cte_documents (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    session_id     uuid REFERENCES public.cte_sessions(id) ON DELETE SET NULL,
    kind           text NOT NULL DEFAULT 'OTRO'
                   CHECK (kind IN ('GUIA_OFICIAL', 'PRESENTACION', 'ACTA', 'EVIDENCIA', 'DIAGNOSTICO', 'OTRO')),
    title          text NOT NULL,
    storage_path   text,
    mime_type      text,
    size_bytes     bigint,
    extracted_text text,
    uploaded_by    uuid DEFAULT auth.uid(),
    created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cte_documents_tenant_idx ON public.cte_documents (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS cte_documents_session_idx ON public.cte_documents (session_id);
ALTER TABLE public.cte_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Managers manage cte documents" ON public.cte_documents;
CREATE POLICY "Managers manage cte documents" ON public.cte_documents
    FOR ALL TO authenticated
    USING (public.is_cte_manager(tenant_id))
    WITH CHECK (public.is_cte_manager(tenant_id));

-- Acuerdos y seguimiento
CREATE TABLE IF NOT EXISTS public.cte_agreements (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id              uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    session_id             uuid REFERENCES public.cte_sessions(id) ON DELETE SET NULL,
    description            text NOT NULL,
    responsible_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    responsible_label      text,
    due_date               date,
    status                 text NOT NULL DEFAULT 'PENDIENTE'
                           CHECK (status IN ('PENDIENTE', 'EN_PROCESO', 'CUMPLIDO', 'NO_CUMPLIDO')),
    follow_up              text,
    created_by             uuid DEFAULT auth.uid(),
    created_at             timestamptz NOT NULL DEFAULT now(),
    updated_at             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cte_agreements_tenant_idx ON public.cte_agreements (tenant_id, status);
CREATE INDEX IF NOT EXISTS cte_agreements_responsible_idx ON public.cte_agreements (responsible_profile_id);
CREATE INDEX IF NOT EXISTS cte_agreements_session_idx ON public.cte_agreements (session_id);
ALTER TABLE public.cte_agreements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Managers manage cte agreements" ON public.cte_agreements;
CREATE POLICY "Managers manage cte agreements" ON public.cte_agreements
    FOR ALL TO authenticated
    USING (public.is_cte_manager(tenant_id))
    WITH CHECK (public.is_cte_manager(tenant_id));
DROP POLICY IF EXISTS "Responsible reads own agreements" ON public.cte_agreements;
CREATE POLICY "Responsible reads own agreements" ON public.cte_agreements
    FOR SELECT TO authenticated
    USING (responsible_profile_id = auth.uid() AND public.is_tenant_member(tenant_id));

-- El docente responsable solo puede reportar avance de SUS acuerdos
CREATE OR REPLACE FUNCTION public.cte_report_agreement(p_id uuid, p_status text, p_follow_up text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_status NOT IN ('PENDIENTE', 'EN_PROCESO', 'CUMPLIDO', 'NO_CUMPLIDO') THEN
        RAISE EXCEPTION 'Estado inválido';
    END IF;
    UPDATE public.cte_agreements
       SET status = p_status,
           follow_up = left(coalesce(p_follow_up, follow_up), 4000),
           updated_at = now()
     WHERE id = p_id
       AND (responsible_profile_id = auth.uid() OR public.is_cte_manager(tenant_id));
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
    END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.cte_report_agreement(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cte_report_agreement(uuid, text, text) TO authenticated;

-- Propuestas generadas con IA (solo dirección/coordinación)
CREATE TABLE IF NOT EXISTS public.cte_proposals (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    session_id  uuid REFERENCES public.cte_sessions(id) ON DELETE CASCADE,
    content     jsonb NOT NULL DEFAULT '{}'::jsonb,
    sources     jsonb NOT NULL DEFAULT '[]'::jsonb,
    status      text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'APPLIED', 'DISCARDED')),
    created_by  uuid DEFAULT auth.uid(),
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cte_proposals_session_idx ON public.cte_proposals (session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS cte_proposals_tenant_idx ON public.cte_proposals (tenant_id);
ALTER TABLE public.cte_proposals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Managers manage cte proposals" ON public.cte_proposals;
CREATE POLICY "Managers manage cte proposals" ON public.cte_proposals
    FOR ALL TO authenticated
    USING (public.is_cte_manager(tenant_id))
    WITH CHECK (public.is_cte_manager(tenant_id));

-- updated_at automático
CREATE OR REPLACE FUNCTION public.cte_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS cte_sessions_touch ON public.cte_sessions;
CREATE TRIGGER cte_sessions_touch BEFORE UPDATE ON public.cte_sessions
    FOR EACH ROW EXECUTE FUNCTION public.cte_touch_updated_at();
DROP TRIGGER IF EXISTS cte_agreements_touch ON public.cte_agreements;
CREATE TRIGGER cte_agreements_touch BEFORE UPDATE ON public.cte_agreements
    FOR EACH ROW EXECUTE FUNCTION public.cte_touch_updated_at();

-- Bucket privado para insumos del CTE: <tenant_id>/<archivo>
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('cte_documents', 'cte_documents', false, 20971520,
        ARRAY['application/pdf',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              'application/vnd.openxmlformats-officedocument.presentationml.presentation',
              'text/plain', 'image/png', 'image/jpeg'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "CTE docs: managers" ON storage.objects;
CREATE POLICY "CTE docs: managers" ON storage.objects
    FOR ALL TO authenticated
    USING (bucket_id = 'cte_documents'
           AND public.is_cte_manager(public.try_uuid((storage.foldername(name))[1])))
    WITH CHECK (bucket_id = 'cte_documents'
           AND public.is_cte_manager(public.try_uuid((storage.foldername(name))[1])));

-- ---------------------------------------------------------------------
-- 4. PEMC: políticas faltantes y alineadas a profile_tenants
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins manage pemc cycles" ON public.pemc_cycles;
DROP POLICY IF EXISTS "Managers manage pemc cycles" ON public.pemc_cycles;
CREATE POLICY "Managers manage pemc cycles" ON public.pemc_cycles
    FOR ALL TO authenticated
    USING (public.is_cte_manager(tenant_id))
    WITH CHECK (public.is_cte_manager(tenant_id));
DROP POLICY IF EXISTS "Members read pemc cycles" ON public.pemc_cycles;
CREATE POLICY "Members read pemc cycles" ON public.pemc_cycles
    FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));

CREATE OR REPLACE FUNCTION public.pemc_cycle_tenant(p_cycle uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT tenant_id FROM public.pemc_cycles WHERE id = p_cycle;
$$;
CREATE OR REPLACE FUNCTION public.pemc_objective_tenant(p_objective uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT c.tenant_id FROM public.pemc_objectives o JOIN public.pemc_cycles c ON c.id = o.cycle_id
    WHERE o.id = p_objective;
$$;
CREATE OR REPLACE FUNCTION public.pemc_action_tenant(p_action uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT c.tenant_id FROM public.pemc_actions a
    JOIN public.pemc_objectives o ON o.id = a.objective_id
    JOIN public.pemc_cycles c ON c.id = o.cycle_id
    WHERE a.id = p_action;
$$;
REVOKE ALL ON FUNCTION public.pemc_cycle_tenant(uuid), public.pemc_objective_tenant(uuid),
    public.pemc_action_tenant(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pemc_cycle_tenant(uuid), public.pemc_objective_tenant(uuid),
    public.pemc_action_tenant(uuid) TO authenticated;

DROP POLICY IF EXISTS "Managers manage pemc diagnosis" ON public.pemc_diagnosis;
CREATE POLICY "Managers manage pemc diagnosis" ON public.pemc_diagnosis FOR ALL TO authenticated
    USING (public.is_cte_manager(public.pemc_cycle_tenant(cycle_id)))
    WITH CHECK (public.is_cte_manager(public.pemc_cycle_tenant(cycle_id)));
DROP POLICY IF EXISTS "Members read pemc diagnosis" ON public.pemc_diagnosis;
CREATE POLICY "Members read pemc diagnosis" ON public.pemc_diagnosis FOR SELECT TO authenticated
    USING (public.is_tenant_member(public.pemc_cycle_tenant(cycle_id)));

DROP POLICY IF EXISTS "Managers manage pemc objectives" ON public.pemc_objectives;
CREATE POLICY "Managers manage pemc objectives" ON public.pemc_objectives FOR ALL TO authenticated
    USING (public.is_cte_manager(public.pemc_cycle_tenant(cycle_id)))
    WITH CHECK (public.is_cte_manager(public.pemc_cycle_tenant(cycle_id)));
DROP POLICY IF EXISTS "Members read pemc objectives" ON public.pemc_objectives;
CREATE POLICY "Members read pemc objectives" ON public.pemc_objectives FOR SELECT TO authenticated
    USING (public.is_tenant_member(public.pemc_cycle_tenant(cycle_id)));

DROP POLICY IF EXISTS "Managers manage pemc actions" ON public.pemc_actions;
CREATE POLICY "Managers manage pemc actions" ON public.pemc_actions FOR ALL TO authenticated
    USING (public.is_cte_manager(public.pemc_objective_tenant(objective_id)))
    WITH CHECK (public.is_cte_manager(public.pemc_objective_tenant(objective_id)));
DROP POLICY IF EXISTS "Members read pemc actions" ON public.pemc_actions;
CREATE POLICY "Members read pemc actions" ON public.pemc_actions FOR SELECT TO authenticated
    USING (public.is_tenant_member(public.pemc_objective_tenant(objective_id)));

DROP POLICY IF EXISTS "Managers manage pemc monitoring" ON public.pemc_monitoring;
CREATE POLICY "Managers manage pemc monitoring" ON public.pemc_monitoring FOR ALL TO authenticated
    USING (public.is_cte_manager(public.pemc_action_tenant(action_id)))
    WITH CHECK (public.is_cte_manager(public.pemc_action_tenant(action_id)));
DROP POLICY IF EXISTS "Members read pemc monitoring" ON public.pemc_monitoring;
CREATE POLICY "Members read pemc monitoring" ON public.pemc_monitoring FOR SELECT TO authenticated
    USING (public.is_tenant_member(public.pemc_action_tenant(action_id)));

-- Evidencias PEMC: carpeta <tenant_id>/...
DROP POLICY IF EXISTS "Auth Access pemc_evidence" ON storage.objects;
DROP POLICY IF EXISTS "PEMC evidence: managers" ON storage.objects;
CREATE POLICY "PEMC evidence: managers" ON storage.objects FOR ALL TO authenticated
    USING (bucket_id = 'pemc_evidence' AND public.is_cte_manager(public.try_uuid((storage.foldername(name))[1])))
    WITH CHECK (bucket_id = 'pemc_evidence' AND public.is_cte_manager(public.try_uuid((storage.foldername(name))[1])));
DROP POLICY IF EXISTS "PEMC evidence: members read" ON storage.objects;
CREATE POLICY "PEMC evidence: members read" ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'pemc_evidence' AND public.is_tenant_member(public.try_uuid((storage.foldername(name))[1])));
