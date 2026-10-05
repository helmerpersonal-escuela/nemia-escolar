-- Un docente que ya usaba VUNLEK por su cuenta (espacio personal) y después es invitado por su escuela
-- puede SUMAR su información a la escuela. Todo es aditivo: nunca borra ni sobrescribe datos de la escuela,
-- y su espacio personal queda intacto (puede seguir entrando desde "Espacio de trabajo").

create table if not exists public.workspace_merge_map (
    to_tenant uuid not null references public.tenants(id) on delete cascade,
    kind text not null,
    old_id uuid not null,
    new_id uuid not null,
    created_by uuid default auth.uid(),
    created_at timestamptz not null default now(),
    primary key (to_tenant, kind, old_id)
);
alter table public.workspace_merge_map enable row level security;
-- Sin políticas: solo la usan las funciones de abajo.

create table if not exists public.workspace_merges (
    id uuid primary key default gen_random_uuid(),
    profile_id uuid not null references public.profiles(id) on delete cascade,
    from_tenant uuid not null references public.tenants(id) on delete cascade,
    to_tenant uuid not null references public.tenants(id) on delete cascade,
    summary jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);
alter table public.workspace_merges enable row level security;
create policy "Veo mis sumas" on public.workspace_merges for select to authenticated
    using (profile_id = auth.uid() or public.is_god_mode() or public.my_role_in_tenant(to_tenant) in ('DIRECTOR', 'ADMIN', 'SYSTEM_ADMIN', 'SCHOOL_CONTROL'));

create or replace function private.norm_name(p text)
returns text language sql immutable set search_path to 'public' as $$
    select upper(regexp_replace(trim(translate(coalesce(p, ''), 'áéíóúüÁÉÍÓÚÜñÑ', 'aeiouuAEIOUUnN')), '\s+', ' ', 'g'));
$$;

create or replace function private.assert_merge(p_from uuid, p_to uuid)
returns void language plpgsql stable security definer set search_path to 'public' as $$
begin
    if auth.uid() is null then raise exception 'Sesión requerida' using errcode = '42501'; end if;
    if not exists (select 1 from profile_tenants pt join tenants t on t.id = pt.tenant_id
                    where pt.profile_id = auth.uid() and pt.tenant_id = p_from and upper(t.type) = 'INDEPENDENT') then
        raise exception 'Ese no es tu espacio personal' using errcode = '42501';
    end if;
    if not exists (select 1 from profile_tenants pt join tenants t on t.id = pt.tenant_id
                    where pt.profile_id = auth.uid() and pt.tenant_id = p_to and upper(t.type) = 'SCHOOL'
                      and upper(pt.role) not in ('TUTOR', 'STUDENT', 'GUEST', 'PENDING')) then
        raise exception 'No perteneces al personal de esa escuela' using errcode = '42501';
    end if;
end $$;

-- Empareja grupos (grado + grupo) y alumnos (CURP o nombre completo) y guarda el mapa. No modifica la escuela.
create or replace function private.merge_match(p_from uuid, p_to uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
    insert into workspace_merge_map (to_tenant, kind, old_id, new_id)
    select p_to, 'group', g.id, sg.id
      from groups g
      join lateral (select s.id from groups s
                     where s.tenant_id = p_to and s.archived_at is null
                       and s.grade::text = g.grade::text and upper(trim(s.section::text)) = upper(trim(g.section::text))
                     order by s.created_at desc limit 1) sg on true
     where g.tenant_id = p_from and g.archived_at is null
    on conflict (to_tenant, kind, old_id) do update set new_id = excluded.new_id;

    insert into workspace_merge_map (to_tenant, kind, old_id, new_id)
    select p_to, 'student', st.id, m.id
      from students st
      join workspace_merge_map gm on gm.to_tenant = p_to and gm.kind = 'group' and gm.old_id = st.group_id
      join lateral (select ss.id from students ss
                     where ss.tenant_id = p_to and ss.group_id = gm.new_id
                       and ((nullif(trim(ss.curp), '') is not null and upper(trim(ss.curp)) = upper(trim(st.curp)))
                         or private.norm_name(concat_ws(' ', ss.last_name_paternal, ss.last_name_maternal, ss.first_name))
                          = private.norm_name(concat_ws(' ', st.last_name_paternal, st.last_name_maternal, st.first_name)))
                     order by (upper(trim(ss.curp)) = upper(trim(st.curp))) desc nulls last limit 1) m on true
     where st.tenant_id = p_from
    on conflict (to_tenant, kind, old_id) do update set new_id = excluded.new_id;
end $$;

-- Qué hay y qué se sumaría (para mostrarlo antes de hacer nada)
create or replace function public.merge_preview(p_from uuid, p_to uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v jsonb;
begin
    perform private.assert_merge(p_from, p_to);
    perform private.merge_match(p_from, p_to);
    select jsonb_build_object(
        'groups', coalesce((select jsonb_agg(x order by x->>'name') from (
            select jsonb_build_object(
                'id', g.id, 'name', g.grade::text || '° ' || g.section::text,
                'school_group_id', gm.new_id,
                'students', (select count(*) from students s where s.group_id = g.id),
                'matched', (select count(*) from students s join workspace_merge_map sm on sm.to_tenant = p_to and sm.kind = 'student' and sm.old_id = s.id where s.group_id = g.id),
                'school_students', (select count(*) from students s where s.group_id = gm.new_id),
                'plans', (select count(*) from lesson_plans lp where lp.group_id = g.id),
                'attendance', (select count(*) from attendance a where a.group_id = g.id)) x
              from groups g
              left join workspace_merge_map gm on gm.to_tenant = p_to and gm.kind = 'group' and gm.old_id = g.id
             where g.tenant_id = p_from and g.archived_at is null) q), '[]'::jsonb),
        'programs', (select count(*) from analytical_programs where tenant_id = p_from),
        'rubrics', (select count(*) from rubrics where tenant_id = p_from),
        'previous', (select count(*) from workspace_merges where profile_id = auth.uid() and from_tenant = p_from and to_tenant = p_to)
    ) into v;
    return v;
end $$;
revoke all on function public.merge_preview(uuid, uuid) from public, anon;
grant execute on function public.merge_preview(uuid, uuid) to authenticated;

-- Suma la información. Opciones (todas true por omisión): students, subjects, plans, programs, rubrics, attendance.
create or replace function public.merge_workspace(p_from uuid, p_to uuid, p_opts jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
    me uuid := auth.uid();
    r record; v_new uuid; v_year uuid;
    n_students int := 0; n_filled int := 0; n_guardians int := 0; n_subjects int := 0; n_subject_conflicts int := 0;
    n_plans int := 0; n_programs int := 0; n_rubrics int := 0; n_attendance int := 0; n_groups_unmatched int := 0;
    v_summary jsonb;
begin
    perform private.assert_merge(p_from, p_to);
    perform private.merge_match(p_from, p_to);
    select count(*) into n_groups_unmatched from groups g
     where g.tenant_id = p_from and g.archived_at is null
       and not exists (select 1 from workspace_merge_map m where m.to_tenant = p_to and m.kind = 'group' and m.old_id = g.id);

    -- 1) Alumnos que la escuela no tiene (en grupos que sí existen en la escuela) + sus tutores
    if coalesce((p_opts->>'students')::boolean, true) then
        for r in select st.*, gm.new_id as school_group
                   from students st
                   join workspace_merge_map gm on gm.to_tenant = p_to and gm.kind = 'group' and gm.old_id = st.group_id
                  where st.tenant_id = p_from and coalesce(st.status, 'ACTIVE') = 'ACTIVE'
                    and not exists (select 1 from workspace_merge_map sm where sm.to_tenant = p_to and sm.kind = 'student' and sm.old_id = st.id) loop
            insert into students (tenant_id, group_id, first_name, last_name_paternal, last_name_maternal, curp, gender, birth_date, status)
            values (p_to, r.school_group, r.first_name, r.last_name_paternal, r.last_name_maternal, nullif(trim(r.curp), ''), r.gender, r.birth_date, 'ACTIVE')
            returning id into v_new;
            insert into workspace_merge_map (to_tenant, kind, old_id, new_id) values (p_to, 'student', r.id, v_new)
            on conflict (to_tenant, kind, old_id) do update set new_id = excluded.new_id;
            n_students := n_students + 1;
        end loop;

        -- Completa datos vacíos de alumnos que ya estaban (CURP, sexo, fecha de nacimiento); no cambia lo que ya tiene la escuela
        with upd as (
            update students ss
               set curp = coalesce(nullif(trim(ss.curp), ''), nullif(trim(st.curp), '')),
                   gender = coalesce(ss.gender, st.gender),
                   birth_date = coalesce(ss.birth_date, st.birth_date)
              from students st
              join workspace_merge_map sm on sm.to_tenant = p_to and sm.kind = 'student' and sm.old_id = st.id
             where ss.id = sm.new_id and st.tenant_id = p_from
               and ((nullif(trim(ss.curp), '') is null and nullif(trim(st.curp), '') is not null)
                 or (ss.gender is null and st.gender is not null)
                 or (ss.birth_date is null and st.birth_date is not null))
            returning 1)
        select count(*) into n_filled from upd;

        -- Tutores: solo para alumnos que en la escuela aún no tienen ninguno
        with ins as (
            insert into guardians (student_id, tenant_id, first_name, last_name_paternal, last_name_maternal, relationship, phone, phone_alt1, phone_alt2)
            select sm.new_id, p_to, g.first_name, g.last_name_paternal, g.last_name_maternal, g.relationship, g.phone, g.phone_alt1, g.phone_alt2
              from guardians g
              join workspace_merge_map sm on sm.to_tenant = p_to and sm.kind = 'student' and sm.old_id = g.student_id
             where g.tenant_id = p_from
               and not exists (select 1 from guardians sg where sg.student_id = sm.new_id)
            returning 1)
        select count(*) into n_guardians from ins;
    end if;

    -- 2) Mis materias en esos grupos: me asigna si están sin docente; las crea si faltan; no toca las de otro docente
    if coalesce((p_opts->>'subjects')::boolean, true) then
        for r in select gs.*, gm.new_id as school_group
                   from group_subjects gs
                   join workspace_merge_map gm on gm.to_tenant = p_to and gm.kind = 'group' and gm.old_id = gs.group_id
                  where gs.tenant_id = p_from and (gs.teacher_id = me or gs.teacher_id is null) loop
            v_new := null; v_year := null;
            select id, teacher_id into v_new, v_year from group_subjects s
             where s.group_id = r.school_group and s.subject_catalog_id is not distinct from r.subject_catalog_id
               and coalesce(s.custom_name, '') = coalesce(r.custom_name, '') limit 1;
            if v_new is null and r.custom_name is null then
                select id, teacher_id into v_new, v_year from group_subjects s
                 where s.group_id = r.school_group and s.subject_catalog_id = r.subject_catalog_id limit 1;
            end if;
            if v_new is null then
                insert into group_subjects (tenant_id, group_id, subject_catalog_id, custom_name, teacher_id)
                values (p_to, r.school_group, r.subject_catalog_id, r.custom_name, me);
                n_subjects := n_subjects + 1;
            elsif v_year is null then
                update group_subjects set teacher_id = me where id = v_new;
                n_subjects := n_subjects + 1;
            elsif v_year <> me then
                n_subject_conflicts := n_subject_conflicts + 1;
            end if;
        end loop;
    end if;

    -- 3) Planeaciones (entran como borrador en la escuela; el periodo se liga al que coincide en fechas)
    if coalesce((p_opts->>'plans')::boolean, true) then
        for r in select lp.*, gm.new_id as school_group,
                        (select sp.id from evaluation_periods mp, evaluation_periods sp
                          where mp.id = lp.period_id and sp.tenant_id = p_to
                            and daterange(sp.start_date, sp.end_date, '[]') && daterange(mp.start_date, mp.end_date, '[]')
                          order by least(sp.end_date, mp.end_date) - greatest(sp.start_date, mp.start_date) desc limit 1) as school_period
                   from lesson_plans lp
                   join workspace_merge_map gm on gm.to_tenant = p_to and gm.kind = 'group' and gm.old_id = lp.group_id
                  where lp.tenant_id = p_from
                    and not exists (select 1 from workspace_merge_map pm where pm.to_tenant = p_to and pm.kind = 'plan' and pm.old_id = lp.id) loop
            insert into lesson_plans (tenant_id, group_id, subject_id, period_id, title, temporality, start_date, end_date, campo_formativo, metodologia,
                                      problem_context, purpose, project_duration, objectives, contents, pda, ejes_articuladores, activities_sequence,
                                      resources, evaluation_plan, source_document_url, extracted_text, textbook_id, textbook_pages_from, textbook_pages_to, status)
            values (p_to, r.school_group, r.subject_id, r.school_period, r.title, r.temporality, r.start_date, r.end_date, r.campo_formativo, r.metodologia,
                    r.problem_context, r.purpose, r.project_duration, r.objectives, r.contents, r.pda, r.ejes_articuladores, r.activities_sequence,
                    r.resources, r.evaluation_plan, r.source_document_url, r.extracted_text, r.textbook_id, r.textbook_pages_from, r.textbook_pages_to, 'DRAFT')
            returning id into v_new;
            insert into workspace_merge_map (to_tenant, kind, old_id, new_id) values (p_to, 'plan', r.id, v_new);
            n_plans := n_plans + 1;
        end loop;
    end if;

    -- 4) Programa analítico (como borrador, en el ciclo activo de la escuela)
    if coalesce((p_opts->>'programs')::boolean, true) then
        select id into v_year from academic_years where tenant_id = p_to and is_active order by start_date desc limit 1;
        if v_year is not null then
            for r in select ap.* from analytical_programs ap
                      where ap.tenant_id = p_from
                        and not exists (select 1 from workspace_merge_map pm where pm.to_tenant = p_to and pm.kind = 'program' and pm.old_id = ap.id) loop
                insert into analytical_programs (tenant_id, academic_year_id, diagnosis_context, problem_statements, status, last_cte_session, school_data,
                                                 external_context, internal_context, group_diagnosis, pedagogical_strategies, evaluation_strategies,
                                                 national_strategies, source_document_url, extracted_text, program_by_fields, field_of_study, created_by)
                values (p_to, v_year, r.diagnosis_context, r.problem_statements, 'DRAFT', r.last_cte_session, r.school_data,
                        r.external_context, r.internal_context, r.group_diagnosis, r.pedagogical_strategies, r.evaluation_strategies,
                        r.national_strategies, r.source_document_url, r.extracted_text, r.program_by_fields, r.field_of_study, me)
                returning id into v_new;
                insert into workspace_merge_map (to_tenant, kind, old_id, new_id) values (p_to, 'program', r.id, v_new);
                n_programs := n_programs + 1;
            end loop;
        end if;
    end if;

    -- 5) Instrumentos de evaluación (rúbricas, listas de cotejo…)
    if coalesce((p_opts->>'rubrics')::boolean, true) then
        for r in select ru.* from rubrics ru
                  where ru.tenant_id = p_from
                    and not exists (select 1 from workspace_merge_map pm where pm.to_tenant = p_to and pm.kind = 'rubric' and pm.old_id = ru.id) loop
            insert into rubrics (tenant_id, title, description, type, content, is_ai_generated, original_prompt, is_public)
            values (p_to, r.title, r.description, r.type, r.content, r.is_ai_generated, r.original_prompt, false)
            returning id into v_new;
            insert into workspace_merge_map (to_tenant, kind, old_id, new_id) values (p_to, 'rubric', r.id, v_new);
            n_rubrics := n_rubrics + 1;
        end loop;
    end if;

    -- 6) Asistencia ya registrada (si ese día ya hay registro en la escuela, se respeta el de la escuela)
    if coalesce((p_opts->>'attendance')::boolean, true) then
        with ins as (
            insert into attendance (tenant_id, group_id, student_id, date, status, notes, subject_id)
            select p_to, gm.new_id, sm.new_id, a.date, a.status, a.notes, a.subject_id
              from attendance a
              join workspace_merge_map gm on gm.to_tenant = p_to and gm.kind = 'group' and gm.old_id = a.group_id
              join workspace_merge_map sm on sm.to_tenant = p_to and sm.kind = 'student' and sm.old_id = a.student_id
             where a.tenant_id = p_from
            on conflict (student_id, date, group_id, subject_id) do nothing
            returning 1)
        select count(*) into n_attendance from ins;
    end if;

    v_summary := jsonb_build_object('students_added', n_students, 'students_completed', n_filled, 'guardians_added', n_guardians,
        'subjects', n_subjects, 'subject_conflicts', n_subject_conflicts, 'plans', n_plans, 'programs', n_programs, 'rubrics', n_rubrics,
        'attendance', n_attendance, 'groups_unmatched', n_groups_unmatched);
    insert into workspace_merges (profile_id, from_tenant, to_tenant, summary) values (me, p_from, p_to, v_summary);

    -- Aviso a la escuela para que revise lo que se sumó
    if n_students + n_guardians + n_filled + n_subjects > 0 then
        insert into support_requests (tenant_id, created_by, kind, title, details)
        values (p_to, me, 'ALUMNOS', 'Un docente sumó información de su espacio personal',
                format('Alumnos agregados: %s · alumnos con datos completados: %s · tutores agregados: %s · materias asignadas: %s. Revísalos en Grupos.',
                       n_students, n_filled, n_guardians, n_subjects));
    end if;
    return v_summary;
end $$;
revoke all on function public.merge_workspace(uuid, uuid, jsonb) from public, anon;
grant execute on function public.merge_workspace(uuid, uuid, jsonb) to authenticated;
