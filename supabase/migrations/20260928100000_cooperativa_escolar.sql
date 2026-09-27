-- Cooperativa Escolar y Proyectos Productivos (Secundarias Técnicas).
-- Socios (aportación de nuevo ingreso), calendario de la circular, formatos oficiales
-- con flujo de revisión por la Coordinación de Actividades Tecnológicas / Área de Producción.

-- 0) Tipo de secundaria
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS secondary_type text CHECK (secondary_type IN ('GENERAL', 'TECNICA'));
ALTER TABLE public.school_details ADD COLUMN IF NOT EXISTS secondary_type text CHECK (secondary_type IN ('GENERAL', 'TECNICA'));

-- Rol del usuario en la escuela activa (perfil o membresía)
CREATE OR REPLACE FUNCTION public.current_tenant_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
    SELECT coalesce(
        (SELECT pt.role FROM profile_tenants pt WHERE pt.profile_id = auth.uid() AND pt.tenant_id = public.get_current_tenant_id() LIMIT 1),
        (SELECT p.role FROM profiles p WHERE p.id = auth.uid()))
$$;

-- Quién revisa y valida la documentación de la cooperativa
CREATE OR REPLACE FUNCTION public.coop_is_reviewer()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
    SELECT public.current_tenant_role() IN ('TECH_COORD', 'DIRECTOR', 'ADMIN', 'ACADEMIC_COORD')
        OR EXISTS (SELECT 1 FROM tenants t WHERE t.id = public.get_current_tenant_id() AND t.type = 'INDEPENDENT')
$$;

-- 1) Cooperativa (una por escuela)
CREATE TABLE IF NOT EXISTS public.cooperatives (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         uuid NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
    name              text NOT NULL,
    registration_key  text NOT NULL,
    kind              text NOT NULL DEFAULT 'PRODUCCION' CHECK (kind IN ('PRODUCCION', 'CONSUMO', 'PRODUCCION_CONSUMO')),
    membership_fee    numeric(10,2) NOT NULL DEFAULT 5.00,
    certificate_value numeric(10,2) NOT NULL DEFAULT 5.00,
    header_lines      text[] NOT NULL DEFAULT ARRAY[
        'SECRETARÍA DE EDUCACIÓN',
        'SUBSECRETARÍA DE EDUCACIÓN FEDERALIZADA',
        'DIRECCIÓN DE EDUCACIÓN SECUNDARIA Y SUPERIOR',
        'DEPARTAMENTO DE EDUCACIÓN SECUNDARIA TÉCNICA',
        'SUBJEFATURA DE PRODUCCIÓN Y EDUCACIÓN TECNOLÓGICA'],
    board             jsonb NOT NULL DEFAULT '{}'::jsonb,   -- presidente, tesorero, secretario, vigilancia, coordinador, director
    distribution      jsonb NOT NULL DEFAULT '{"social":40,"repartible":40,"reserva":20}'::jsonb,
    created_by        uuid DEFAULT auth.uid(),
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now()
);

-- 2) Unidades de producción (énfasis tecnológico de cada docente)
CREATE TABLE IF NOT EXISTS public.coop_production_units (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    cooperative_id  uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
    teacher_id      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    name            text NOT NULL,           -- Ej. AGRICULTURA, ELECTRICIDAD, CONFECCIÓN DEL VESTIDO
    weekly_hours    integer,
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS coop_units_tenant_idx ON public.coop_production_units (tenant_id);

-- 3) Socios
CREATE TABLE IF NOT EXISTS public.coop_partners (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    cooperative_id   uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
    student_id       uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    academic_year_id uuid REFERENCES public.academic_years(id) ON DELETE SET NULL,
    group_label      text,
    folio            integer NOT NULL,
    amount           numeric(10,2) NOT NULL DEFAULT 5.00,
    certificates     integer NOT NULL DEFAULT 1,
    joined_at        date NOT NULL DEFAULT current_date,
    status           text NOT NULL DEFAULT 'ACTIVO' CHECK (status IN ('ACTIVO', 'DEVUELTO', 'BAJA')),
    returned_at      date,
    returned_amount  numeric(10,2),
    registered_by    uuid DEFAULT auth.uid(),
    created_at       timestamptz NOT NULL DEFAULT now(),
    UNIQUE (cooperative_id, student_id),
    UNIQUE (cooperative_id, folio)
);
CREATE INDEX IF NOT EXISTS coop_partners_tenant_idx ON public.coop_partners (tenant_id);

-- Folio consecutivo por cooperativa
CREATE OR REPLACE FUNCTION public.coop_partner_folio() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.folio IS NULL OR NEW.folio = 0 THEN
        PERFORM pg_advisory_xact_lock(hashtext(NEW.cooperative_id::text));
        SELECT coalesce(max(folio), 0) + 1 INTO NEW.folio FROM public.coop_partners WHERE cooperative_id = NEW.cooperative_id;
    END IF;
    RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS coop_partner_folio ON public.coop_partners;
CREATE TRIGGER coop_partner_folio BEFORE INSERT ON public.coop_partners FOR EACH ROW EXECUTE FUNCTION public.coop_partner_folio();
ALTER TABLE public.coop_partners ALTER COLUMN folio SET DEFAULT 0;

-- 4) Fechas de entrega de la circular
CREATE TABLE IF NOT EXISTS public.coop_deadlines (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    academic_year_id uuid REFERENCES public.academic_years(id) ON DELETE CASCADE,
    doc_type         text NOT NULL,
    due_date         date NOT NULL,
    circular_ref     text,        -- Núm./fecha de la circular
    notes            text,
    created_by       uuid DEFAULT auth.uid(),
    created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS coop_deadlines_tenant_idx ON public.coop_deadlines (tenant_id, due_date);

-- 5) Formatos oficiales
CREATE TABLE IF NOT EXISTS public.coop_documents (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    cooperative_id   uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
    academic_year_id uuid REFERENCES public.academic_years(id) ON DELETE SET NULL,
    unit_id          uuid REFERENCES public.coop_production_units(id) ON DELETE SET NULL,
    teacher_id       uuid DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE SET NULL,
    doc_type         text NOT NULL CHECK (doc_type IN ('PLAN_ANUAL', 'PRESUPUESTO', 'INFORME_SEMESTRAL', 'INFORME_ANUAL',
                                                       'NOMINA_FONDO_REPARTIBLE', 'NOMINA_CERTIFICADOS_DEVUELTOS')),
    title            text,
    data             jsonb NOT NULL DEFAULT '{}'::jsonb,
    status           text NOT NULL DEFAULT 'BORRADOR' CHECK (status IN ('BORRADOR', 'ENVIADO', 'APROBADO', 'CON_OBSERVACIONES')),
    submitted_at     timestamptz,
    reviewed_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at      timestamptz,
    review_notes     text,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS coop_documents_tenant_idx ON public.coop_documents (tenant_id, academic_year_id);

CREATE TABLE IF NOT EXISTS public.coop_document_events (
    id          bigserial PRIMARY KEY,
    tenant_id   uuid NOT NULL,
    document_id uuid NOT NULL REFERENCES public.coop_documents(id) ON DELETE CASCADE,
    status      text NOT NULL,
    notes       text,
    actor_id    uuid DEFAULT auth.uid(),
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- Reglas del flujo: Borrador → Enviado → Aprobado / Con observaciones
CREATE OR REPLACE FUNCTION public.coop_document_rules() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
    v_owner boolean := (OLD.teacher_id = auth.uid());
    v_reviewer boolean := public.coop_is_reviewer();
BEGIN
    IF auth.uid() IS NULL THEN RETURN NEW; END IF;   -- tareas del servidor
    NEW.updated_at := now();

    IF NEW.status IS DISTINCT FROM OLD.status THEN
        IF NEW.status = 'ENVIADO' THEN
            IF NOT (v_owner OR v_reviewer) THEN RAISE EXCEPTION 'Solo el docente responsable puede enviar este formato'; END IF;
            IF OLD.status NOT IN ('BORRADOR', 'CON_OBSERVACIONES') THEN RAISE EXCEPTION 'El formato ya fue enviado'; END IF;
            NEW.submitted_at := now();
        ELSIF NEW.status IN ('APROBADO', 'CON_OBSERVACIONES') THEN
            IF NOT v_reviewer THEN RAISE EXCEPTION 'Solo la Coordinación de Actividades Tecnológicas o la Dirección pueden validar'; END IF;
            NEW.reviewed_by := auth.uid();
            NEW.reviewed_at := now();
        ELSIF NEW.status = 'BORRADOR' THEN
            IF NOT (v_owner OR v_reviewer) THEN RAISE EXCEPTION 'Sin permiso'; END IF;
        END IF;
        INSERT INTO coop_document_events (tenant_id, document_id, status, notes) VALUES (NEW.tenant_id, NEW.id, NEW.status, CASE WHEN NEW.status IN ('APROBADO', 'CON_OBSERVACIONES') THEN NEW.review_notes END);
    ELSE
        -- Contenido: solo el responsable y solo en borrador o con observaciones
        IF NEW.data IS DISTINCT FROM OLD.data OR NEW.title IS DISTINCT FROM OLD.title THEN
            IF NOT (v_owner OR (v_reviewer AND OLD.teacher_id IS NULL)) THEN RAISE EXCEPTION 'Solo el docente responsable puede editar este formato'; END IF;
            IF OLD.status IN ('ENVIADO', 'APROBADO') THEN RAISE EXCEPTION 'El formato está en revisión o aprobado; no se puede editar'; END IF;
        END IF;
    END IF;
    RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS coop_document_rules ON public.coop_documents;
CREATE TRIGGER coop_document_rules BEFORE UPDATE ON public.coop_documents FOR EACH ROW EXECUTE FUNCTION public.coop_document_rules();

-- 6) Seguridad por escuela
DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['cooperatives', 'coop_production_units', 'coop_partners', 'coop_deadlines', 'coop_documents', 'coop_document_events'] LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('DROP POLICY IF EXISTS "Tenant reads %1$s" ON public.%1$I', t);
        EXECUTE format('CREATE POLICY "Tenant reads %1$s" ON public.%1$I FOR SELECT TO authenticated USING (tenant_id = public.get_current_tenant_id())', t);
        EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    END LOOP;
END $$;
GRANT USAGE, SELECT ON SEQUENCE public.coop_document_events_id_seq TO authenticated;

DROP POLICY IF EXISTS "Tenant writes cooperatives" ON public.cooperatives;
CREATE POLICY "Tenant writes cooperatives" ON public.cooperatives FOR ALL TO authenticated
    USING (tenant_id = public.get_current_tenant_id()) WITH CHECK (tenant_id = public.get_current_tenant_id());
DROP POLICY IF EXISTS "Tenant writes units" ON public.coop_production_units;
CREATE POLICY "Tenant writes units" ON public.coop_production_units FOR ALL TO authenticated
    USING (tenant_id = public.get_current_tenant_id()) WITH CHECK (tenant_id = public.get_current_tenant_id());
DROP POLICY IF EXISTS "Tenant writes partners" ON public.coop_partners;
CREATE POLICY "Tenant writes partners" ON public.coop_partners FOR ALL TO authenticated
    USING (tenant_id = public.get_current_tenant_id()) WITH CHECK (tenant_id = public.get_current_tenant_id());
DROP POLICY IF EXISTS "Tenant writes deadlines" ON public.coop_deadlines;
CREATE POLICY "Tenant writes deadlines" ON public.coop_deadlines FOR ALL TO authenticated
    USING (tenant_id = public.get_current_tenant_id()) WITH CHECK (tenant_id = public.get_current_tenant_id());
DROP POLICY IF EXISTS "Tenant inserts documents" ON public.coop_documents;
CREATE POLICY "Tenant inserts documents" ON public.coop_documents FOR INSERT TO authenticated
    WITH CHECK (tenant_id = public.get_current_tenant_id());
DROP POLICY IF EXISTS "Tenant updates documents" ON public.coop_documents;
CREATE POLICY "Tenant updates documents" ON public.coop_documents FOR UPDATE TO authenticated
    USING (tenant_id = public.get_current_tenant_id()) WITH CHECK (tenant_id = public.get_current_tenant_id());
DROP POLICY IF EXISTS "Owner deletes drafts" ON public.coop_documents;
CREATE POLICY "Owner deletes drafts" ON public.coop_documents FOR DELETE TO authenticated
    USING (tenant_id = public.get_current_tenant_id() AND teacher_id = auth.uid() AND status IN ('BORRADOR', 'CON_OBSERVACIONES'));
