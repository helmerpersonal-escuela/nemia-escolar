-- Cierre de ciclo e inicio del siguiente (asistente "Nuevo ciclo escolar"),
-- historial de alumnos por ciclo y PDAs propios del docente.

-- 1) Grupos de ciclos anteriores: se conservan (historial) pero dejan de aparecer en el día a día.
ALTER TABLE public.groups
    ADD COLUMN IF NOT EXISTS archived_at      timestamptz,
    ADD COLUMN IF NOT EXISTS promoted_from_id uuid REFERENCES public.groups(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS groups_active_idx ON public.groups (tenant_id) WHERE archived_at IS NULL;

ALTER TABLE public.academic_years ADD COLUMN IF NOT EXISTS closed_at timestamptz;
ALTER TABLE public.analytical_programs ADD COLUMN IF NOT EXISTS based_on_id uuid REFERENCES public.analytical_programs(id) ON DELETE SET NULL;
ALTER TABLE public.lesson_plans ADD COLUMN IF NOT EXISTS based_on_id uuid REFERENCES public.lesson_plans(id) ON DELETE SET NULL;

-- 2) Historial: en qué grupo estuvo cada alumno en cada ciclo y cómo terminó.
CREATE TABLE IF NOT EXISTS public.student_enrollments (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    student_id       uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    academic_year_id uuid REFERENCES public.academic_years(id) ON DELETE SET NULL,
    group_id         uuid REFERENCES public.groups(id) ON DELETE SET NULL,
    grade            text,
    section          text,
    outcome          text NOT NULL CHECK (outcome IN ('PROMOVIDO', 'REPITE', 'EGRESADO', 'BAJA')),
    created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS student_enrollments_student_idx ON public.student_enrollments (student_id);
ALTER TABLE public.student_enrollments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant reads enrollments" ON public.student_enrollments;
CREATE POLICY "Tenant reads enrollments" ON public.student_enrollments FOR SELECT TO authenticated
    USING (tenant_id = public.get_current_tenant_id());

-- 3) PDAs propios (el docente o la escuela los crea y los usa en su programa analítico y planeación).
CREATE TABLE IF NOT EXISTS public.custom_pdas (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    created_by       uuid DEFAULT auth.uid(),
    phase            integer,
    educational_level text,
    field_of_study   text NOT NULL,
    subject_name     text,
    grade            integer,
    content          text NOT NULL,
    pda              text NOT NULL,
    base_content_id  uuid REFERENCES public.synthetic_program_contents(id) ON DELETE SET NULL,
    notes            text,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS custom_pdas_tenant_idx ON public.custom_pdas (tenant_id);
ALTER TABLE public.custom_pdas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant manages custom pdas" ON public.custom_pdas;
CREATE POLICY "Tenant manages custom pdas" ON public.custom_pdas FOR ALL TO authenticated
    USING (tenant_id = public.get_current_tenant_id())
    WITH CHECK (tenant_id = public.get_current_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_pdas TO authenticated;

-- 4) Inicio del nuevo ciclo en una sola transacción.
--    p = { new_year: {name, start_date, end_date},
--          groups: [{ old_group_id, action: 'PROMOTE'|'GRADUATE'|'CLOSE', new_grade, new_section,
--                     students: [{ id, outcome: 'PROMOVIDO'|'REPITE'|'BAJA'|'EGRESADO' }] }],
--          new_groups: [{ grade, section, shift }],
--          copy_analytical_program: bool, copy_lesson_plans: bool }
CREATE OR REPLACE FUNCTION public.start_new_school_year(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
    v_tenant   uuid := public.get_current_tenant_id();
    v_old_year uuid;
    v_new_year uuid;
    g          jsonb;
    s          jsonb;
    ng         jsonb;
    v_old      record;
    v_new_group uuid;
    v_outcome  text;
    v_map      jsonb := '{}'::jsonb;   -- old_group_id -> new_group_id (promovidos)
    v_target   uuid;
    v_prog     record;
    v_new_prog uuid;
    v_count_groups int := 0;
    v_count_students int := 0;
    v_count_grad int := 0;
    v_count_plans int := 0;
BEGIN
    IF v_tenant IS NULL THEN RAISE EXCEPTION 'Sin escuela activa'; END IF;
    IF NOT EXISTS (
        SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND (
            (pr.tenant_id = v_tenant AND pr.role IN ('DIRECTOR', 'ADMIN', 'INDEPENDENT_TEACHER', 'SCHOOL_CONTROL', 'SUPER_ADMIN'))
            OR EXISTS (SELECT 1 FROM profile_tenants pt WHERE pt.profile_id = pr.id AND pt.tenant_id = v_tenant
                       AND pt.role IN ('DIRECTOR', 'ADMIN', 'INDEPENDENT_TEACHER', 'SCHOOL_CONTROL'))
        )
    ) THEN
        RAISE EXCEPTION 'Solo la dirección o el docente titular puede iniciar el nuevo ciclo';
    END IF;

    SELECT id INTO v_old_year FROM academic_years WHERE tenant_id = v_tenant AND is_active ORDER BY start_date DESC LIMIT 1;

    -- Nuevo ciclo
    UPDATE academic_years SET is_active = false, closed_at = coalesce(closed_at, now()) WHERE tenant_id = v_tenant AND is_active;
    INSERT INTO academic_years (tenant_id, name, start_date, end_date, is_active)
    VALUES (v_tenant, upper(p->'new_year'->>'name'), (p->'new_year'->>'start_date')::date, (p->'new_year'->>'end_date')::date, true)
    RETURNING id INTO v_new_year;

    -- Pasada 1: grupos que continúan (suben de grado) y los que egresan / se cierran
    FOR g IN SELECT * FROM jsonb_array_elements(coalesce(p->'groups', '[]'::jsonb)) LOOP
        SELECT * INTO v_old FROM groups WHERE id = (g->>'old_group_id')::uuid AND tenant_id = v_tenant;
        IF NOT FOUND THEN CONTINUE; END IF;

        IF g->>'action' = 'PROMOTE' THEN
            INSERT INTO groups (tenant_id, academic_year_id, grade, section, shift, promoted_from_id)
            VALUES (v_tenant, v_new_year, g->>'new_grade', upper(coalesce(g->>'new_section', v_old.section)), v_old.shift, v_old.id)
            RETURNING id INTO v_new_group;
            v_map := v_map || jsonb_build_object(v_old.id::text, v_new_group::text);
            v_count_groups := v_count_groups + 1;
            -- Materias y docentes asignados se conservan
            INSERT INTO group_subjects (tenant_id, group_id, subject_catalog_id, custom_name, teacher_id)
            SELECT tenant_id, v_new_group, subject_catalog_id, custom_name, teacher_id FROM group_subjects WHERE group_id = v_old.id;
        END IF;

        UPDATE groups SET archived_at = now() WHERE id = v_old.id;
    END LOOP;

    -- Grupos nuevos (por lo general, primer grado)
    FOR ng IN SELECT * FROM jsonb_array_elements(coalesce(p->'new_groups', '[]'::jsonb)) LOOP
        INSERT INTO groups (tenant_id, academic_year_id, grade, section, shift)
        VALUES (v_tenant, v_new_year, ng->>'grade', upper(ng->>'section'), coalesce(ng->>'shift', 'MORNING'));
        v_count_groups := v_count_groups + 1;
    END LOOP;

    -- Pasada 2: alumnos
    FOR g IN SELECT * FROM jsonb_array_elements(coalesce(p->'groups', '[]'::jsonb)) LOOP
        SELECT * INTO v_old FROM groups WHERE id = (g->>'old_group_id')::uuid AND tenant_id = v_tenant;
        IF NOT FOUND THEN CONTINUE; END IF;

        FOR s IN
            SELECT jsonb_build_object('id', st.id, 'outcome', coalesce(
                (SELECT x->>'outcome' FROM jsonb_array_elements(coalesce(g->'students', '[]'::jsonb)) x WHERE (x->>'id')::uuid = st.id LIMIT 1),
                CASE g->>'action' WHEN 'PROMOTE' THEN 'PROMOVIDO' WHEN 'GRADUATE' THEN 'EGRESADO' ELSE 'BAJA' END))
            FROM students st
            WHERE st.group_id = v_old.id AND coalesce(st.status, 'ACTIVE') NOT IN ('GRADUATED', 'INACTIVE')
        LOOP
            v_outcome := s->>'outcome';
            IF v_outcome NOT IN ('PROMOVIDO', 'REPITE', 'EGRESADO', 'BAJA') THEN v_outcome := 'PROMOVIDO'; END IF;

            INSERT INTO student_enrollments (tenant_id, student_id, academic_year_id, group_id, grade, section, outcome)
            VALUES (v_tenant, (s->>'id')::uuid, coalesce(v_old.academic_year_id, v_old_year), v_old.id, v_old.grade, v_old.section, v_outcome);

            IF v_outcome = 'PROMOVIDO' AND v_map ? v_old.id::text THEN
                UPDATE students SET group_id = (v_map->>v_old.id::text)::uuid, status = 'ACTIVE' WHERE id = (s->>'id')::uuid;
                v_count_students := v_count_students + 1;
            ELSIF v_outcome = 'REPITE' THEN
                -- Mismo grado y grupo en el nuevo ciclo (se crea si no existe)
                SELECT id INTO v_target FROM groups
                 WHERE tenant_id = v_tenant AND academic_year_id = v_new_year AND grade = v_old.grade AND upper(section) = upper(v_old.section)
                 LIMIT 1;
                IF v_target IS NULL THEN
                    INSERT INTO groups (tenant_id, academic_year_id, grade, section, shift)
                    VALUES (v_tenant, v_new_year, v_old.grade, upper(v_old.section), v_old.shift) RETURNING id INTO v_target;
                    v_count_groups := v_count_groups + 1;
                END IF;
                UPDATE students SET group_id = v_target, status = 'ACTIVE' WHERE id = (s->>'id')::uuid;
                v_count_students := v_count_students + 1;
                v_target := NULL;
            ELSIF v_outcome = 'EGRESADO' THEN
                UPDATE students SET status = 'GRADUATED' WHERE id = (s->>'id')::uuid;
                v_count_grad := v_count_grad + 1;
            ELSE
                UPDATE students SET status = 'INACTIVE' WHERE id = (s->>'id')::uuid;
            END IF;
        END LOOP;
    END LOOP;

    -- Programa analítico: copia para seguir mejorándolo en el nuevo ciclo
    IF coalesce((p->>'copy_analytical_program')::boolean, true) AND v_old_year IS NOT NULL THEN
        FOR v_prog IN SELECT * FROM analytical_programs WHERE tenant_id = v_tenant AND academic_year_id = v_old_year LOOP
            INSERT INTO analytical_programs (tenant_id, academic_year_id, diagnosis_context, problem_statements, status, school_data,
                external_context, internal_context, group_diagnosis, pedagogical_strategies, evaluation_strategies,
                national_strategies, source_document_url, extracted_text, program_by_fields, based_on_id)
            VALUES (v_tenant, v_new_year, v_prog.diagnosis_context, v_prog.problem_statements, v_prog.status, v_prog.school_data,
                v_prog.external_context, v_prog.internal_context, v_prog.group_diagnosis, v_prog.pedagogical_strategies, v_prog.evaluation_strategies,
                v_prog.national_strategies, v_prog.source_document_url, v_prog.extracted_text, v_prog.program_by_fields, v_prog.id)
            RETURNING id INTO v_new_prog;
            INSERT INTO analytical_program_contents (program_id, campo_formativo, content_id, custom_content, pda_ids, justification, temporality, ejes_articuladores, subject_id)
            SELECT v_new_prog, campo_formativo, content_id, custom_content, pda_ids, justification, temporality, ejes_articuladores, subject_id
            FROM analytical_program_contents WHERE program_id = v_prog.id;
        END LOOP;
    END IF;

    -- Planeaciones: se copian al grupo del mismo grado y letra del nuevo ciclo (como borrador)
    IF coalesce((p->>'copy_lesson_plans')::boolean, true) THEN
        INSERT INTO lesson_plans (tenant_id, group_id, subject_id, title, temporality, campo_formativo, metodologia,
            problem_context, purpose, project_duration, objectives, contents, pda, ejes_articuladores, activities_sequence,
            resources, evaluation_plan, textbook_id, textbook_pages_from, textbook_pages_to, status, based_on_id)
        SELECT lp.tenant_id, ng2.id, lp.subject_id, lp.title, lp.temporality, lp.campo_formativo, lp.metodologia,
            lp.problem_context, lp.purpose, lp.project_duration, lp.objectives, lp.contents, lp.pda, lp.ejes_articuladores, lp.activities_sequence,
            lp.resources, lp.evaluation_plan, lp.textbook_id, lp.textbook_pages_from, lp.textbook_pages_to, 'DRAFT', lp.id
        FROM lesson_plans lp
        JOIN groups og ON og.id = lp.group_id AND og.tenant_id = v_tenant AND (og.academic_year_id = v_old_year OR og.academic_year_id IS NULL OR v_old_year IS NULL) AND og.archived_at IS NOT NULL
        JOIN groups ng2 ON ng2.tenant_id = v_tenant AND ng2.academic_year_id = v_new_year AND ng2.grade = og.grade AND upper(ng2.section) = upper(og.section)
        WHERE lp.tenant_id = v_tenant;
        GET DIAGNOSTICS v_count_plans = ROW_COUNT;
    END IF;

    RETURN jsonb_build_object('academic_year_id', v_new_year, 'groups', v_count_groups, 'students', v_count_students,
                              'graduated', v_count_grad, 'lesson_plans', v_count_plans);
END;
$$;
REVOKE ALL ON FUNCTION public.start_new_school_year(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_new_school_year(jsonb) TO authenticated;
