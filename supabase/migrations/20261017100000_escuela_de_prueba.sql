-- Escuela de prueba (datos ficticios) para probar VUNLEK sin tocar a las escuelas reales.
-- La crea tools/demo/crear-escuela-demo.mjs: primero las cuentas de acceso y luego esta función.
-- Todo lo que se crea queda anotado en demo_runs; la limpieza borra SOLO lo anotado ahí.

create table if not exists public.demo_runs (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null,
    user_ids uuid[] not null default '{}',
    summary jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);
alter table public.demo_runs enable row level security;
revoke all on public.demo_runs from anon, authenticated;

create or replace function public.demo_seed(p_people jsonb)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
    nom_h text[] := array['Santiago','Mateo','Sebastián','Leonardo','Emiliano','Diego','Daniel','Alexander','Miguel Ángel','Ángel','Carlos','José Luis','Fernando','Ricardo','Luis','Jorge','Eduardo','Raúl','Óscar','Iván'];
    nom_m text[] := array['Sofía','Valentina','Regina','María José','Ximena','Camila','Fernanda','Renata','Daniela','Andrea','Guadalupe','Mariana','Alejandra','Paola','Karla','Rosa','Laura','Patricia','Gabriela','Verónica'];
    apes text[] := array['Hernández','García','Martínez','López','González','Pérez','Rodríguez','Sánchez','Ramírez','Cruz','Gómez','Flores','Morales','Vázquez','Jiménez','Reyes','Díaz','Torres','Gutiérrez','Ruiz','Mendoza','Aguilar','Ortiz','Castillo','Moreno','Domínguez','Velasco','Méndez','Solís','Zenteno'];
    disc jsonb := '[
      {"pat":"espa_ol","t":1,"g":[1,2,3]},{"pat":"matem_ticas","t":2,"g":[1,2,3]},
      {"pat":"biolog_a","t":3,"g":[1]},{"pat":"f_sica","t":3,"g":[2]},{"pat":"qu_mica","t":3,"g":[3]},
      {"pat":"historia","t":4,"g":[1,2,3]},{"pat":"geograf_a","t":4,"g":[1]},
      {"pat":"formaci_n c_vica%","t":5,"g":[1,2,3]},{"pat":"ingl_s","t":6,"g":[1,2,3]},
      {"pat":"artes","t":7,"g":[1,2,3]},{"pat":"tecnolog_a","t":8,"g":[1,2,3]},
      {"pat":"educaci_n f_sica","t":9,"g":[1,2,3]},{"pat":"tutor_a%","t":10,"g":[1,2,3]}]';
    campos text[] := array['Lenguajes','Saberes y Pensamiento Científico','Ética, Naturaleza y Sociedades','De lo Humano y lo Comunitario'];
    campo_key text[] := array['lenguajes','saberes','etica','humano'];
    g_grade int[] := array[1,1,2,2,3,3];
    g_sec text[] := array['A','B','A','B','A','B'];
    v_tenant uuid; v_year uuid; v_y1 uuid; v_y2 uuid; v_p1 uuid;
    v_groups uuid[] := '{}';
    v_director uuid; v_stu_user uuid;
    v_teachers uuid[] := '{}'; v_tutors uuid[] := '{}'; v_all uuid[] := '{}';
    stu_ids uuid[] := '{}'; stu_grp int[] := '{}'; stu_used boolean[] := '{}';
    people jsonb := '[]'::jsonb;
    d jsonb; r record; i int; j int; k int; g int; pick int; n int;
    v_id uuid; v_sub uuid; v_fn text; v_ap text; v_am text; v_sex text; v_name text;
    targets int[]; kids jsonb; v_prog uuid; items jsonb; v_creator uuid;
begin
    if coalesce(auth.role(), '') <> 'service_role' and session_user not in ('postgres', 'supabase_admin') then
        raise exception 'Solo el servidor puede crear la escuela de prueba';
    end if;
    if exists (select 1 from demo_runs) then
        raise exception 'Ya existe una escuela de prueba. Bórrala antes de crear otra (npm run demo:borrar).';
    end if;

    select array_agg((x->>'id')::uuid order by (x->>'n')::int) filter (where x->>'kind' = 'TEACHER'),
           array_agg((x->>'id')::uuid order by (x->>'n')::int) filter (where x->>'kind' = 'TUTOR'),
           (array_agg((x->>'id')::uuid) filter (where x->>'kind' = 'DIRECTOR'))[1],
           (array_agg((x->>'id')::uuid) filter (where x->>'kind' = 'STUDENT'))[1],
           array_agg((x->>'id')::uuid)
      into v_teachers, v_tutors, v_director, v_stu_user, v_all
      from jsonb_array_elements(p_people) x;
    if v_director is null or coalesce(array_length(v_teachers, 1), 0) <> 10 or coalesce(array_length(v_tutors, 1), 0) <> 25 then
        raise exception 'Se esperaban 1 dirección, 10 docentes y 25 tutores';
    end if;
    -- Solo cuentas recién creadas para la demostración: nunca se toca una cuenta real
    if exists (select 1 from unnest(v_all) u(id) left join profiles p on p.id = u.id
               where p.id is null or p.role <> 'PENDING' or p.tenant_id is not null or p.email not like 'demo.%@demo.vunlek.test') then
        raise exception 'Alguna cuenta no es una cuenta de demostración recién creada';
    end if;

    perform setseed(0.37);

    -- 1. Escuela, ciclos, periodos y grupos
    insert into tenants (name, type, educational_level, secondary_type, cct, address, phone, onboarding_completed)
    values ('Escuela Secundaria Técnica de Demostración "Rosario Castellanos"', 'SCHOOL', 'SECONDARY', 'TECNICA', '07DST9990Z',
            'Av. Las Jacarandas 120, Col. Centro, Tuxtla Gutiérrez, Chiapas, C.P. 29000', '961 555 0100', true)
    returning id into v_tenant;

    insert into academic_years (tenant_id, name, start_date, end_date, is_active, closed_at)
    values (v_tenant, '2024-2025', '2024-08-26', '2025-07-15', false, '2025-07-16') returning id into v_y1;
    insert into academic_years (tenant_id, name, start_date, end_date, is_active, closed_at)
    values (v_tenant, '2025-2026', '2025-09-01', '2026-07-15', false, '2026-07-16') returning id into v_y2;
    insert into academic_years (tenant_id, name, start_date, end_date, is_active)
    values (v_tenant, '2026-2027', '2026-08-31', '2027-07-15', true) returning id into v_year;

    insert into evaluation_periods (tenant_id, name, start_date, end_date, is_active)
    values (v_tenant, 'Primer trimestre', '2026-08-31', '2026-11-27', true) returning id into v_p1;
    insert into evaluation_periods (tenant_id, name, start_date, end_date, is_active) values
        (v_tenant, 'Segundo trimestre', '2026-11-30', '2027-03-19', false),
        (v_tenant, 'Tercer trimestre', '2027-03-22', '2027-07-15', false);
    insert into schedule_settings (tenant_id, start_time, end_time, module_duration, breaks)
    values (v_tenant, '07:00', '13:10', 50, '[{"name":"Receso","start_time":"09:30","end_time":"09:50"}]'::jsonb);

    for i in 1..6 loop
        insert into groups (tenant_id, academic_year_id, grade, section, shift)
        values (v_tenant, v_year, g_grade[i]::text, g_sec[i], 'MORNING') returning id into v_id;
        v_groups := v_groups || v_id;
        insert into evaluation_criteria (tenant_id, period_id, group_id, name, percentage, description) values
            (v_tenant, v_p1, v_id, 'Tareas', 30, 'Trabajos en casa y en clase'),
            (v_tenant, v_p1, v_id, 'Proyectos', 30, 'Proyecto del trimestre'),
            (v_tenant, v_p1, v_id, 'Examen', 40, 'Evaluación escrita');
    end loop;

    -- 2. Dirección y docentes
    v_fn := 'Laura Elena'; v_ap := 'Coutiño'; v_am := 'Nucamendi';
    insert into profile_tenants (profile_id, tenant_id, role, is_default, first_name, last_name_paternal, last_name_maternal, job_title)
    values (v_director, v_tenant, 'DIRECTOR', true, v_fn, v_ap, v_am, 'Directora');
    update profiles set tenant_id = v_tenant, role = 'DIRECTOR', first_name = v_fn, last_name_paternal = v_ap, last_name_maternal = v_am,
           full_name = v_fn || ' ' || v_ap || ' ' || v_am, profile_setup_completed = true where id = v_director;
    people := people || jsonb_build_object('id', v_director, 'kind', 'DIRECTOR', 'n', 1, 'name', v_fn || ' ' || v_ap || ' ' || v_am, 'detail', 'Dirección');

    for i in 1..10 loop
        if i % 2 = 0 then v_fn := nom_h[i]; else v_fn := nom_m[i]; end if;
        v_ap := apes[i]; v_am := apes[i + 12];
        insert into profile_tenants (profile_id, tenant_id, role, is_default, first_name, last_name_paternal, last_name_maternal, job_title)
        values (v_teachers[i], v_tenant, 'TEACHER', true, v_fn, v_ap, v_am, 'Docente');
        update profiles set tenant_id = v_tenant, role = 'TEACHER', first_name = v_fn, last_name_paternal = v_ap, last_name_maternal = v_am,
               full_name = v_fn || ' ' || v_ap || ' ' || v_am, profile_setup_completed = true where id = v_teachers[i];
    end loop;

    -- 3. Materias por grupo, cada una con su docente
    for d in select * from jsonb_array_elements(disc) loop
        select id into v_sub from subject_catalog
        where educational_level in ('SECONDARY', 'BOTH') and lower(name) like d->>'pat'
        order by created_at nulls last, id limit 1;
        continue when v_sub is null;
        i := (d->>'t')::int;
        insert into profile_subjects (profile_id, tenant_id, subject_catalog_id) values (v_teachers[i], v_tenant, v_sub) on conflict do nothing;
        for g in 1..6 loop
            if d->'g' @> to_jsonb(g_grade[g]) then
                insert into group_subjects (tenant_id, group_id, subject_catalog_id, teacher_id) values (v_tenant, v_groups[g], v_sub, v_teachers[i]);
            end if;
        end loop;
    end loop;
    update profiles set advisory_group_id = v_groups[1] where id = v_teachers[10];

    for i in 1..10 loop
        select string_agg(distinct initcap(sc.name), ', ') into v_name
        from group_subjects gs join subject_catalog sc on sc.id = gs.subject_catalog_id where gs.tenant_id = v_tenant and gs.teacher_id = v_teachers[i];
        people := people || jsonb_build_object('id', v_teachers[i], 'kind', 'TEACHER', 'n', i,
            'name', (select first_name || ' ' || last_name_paternal || ' ' || last_name_maternal from profiles where id = v_teachers[i]), 'detail', coalesce(v_name, 'Sin materia'));
    end loop;

    -- 4. Alumnos: 6 por grupo y el resto al azar
    for i in 1..50 loop
        if i <= 36 then g := ((i - 1) % 6) + 1; else g := 1 + floor(random() * 6)::int; end if;
        if random() < 0.5 then v_sex := 'HOMBRE'; v_fn := nom_h[1 + floor(random() * 20)::int];
        else v_sex := 'MUJER'; v_fn := nom_m[1 + floor(random() * 20)::int]; end if;
        v_ap := apes[1 + floor(random() * 30)::int]; v_am := apes[1 + floor(random() * 30)::int];
        insert into students (tenant_id, group_id, first_name, last_name_paternal, last_name_maternal, gender, birth_date, status, address)
        values (v_tenant, v_groups[g], v_fn, v_ap, v_am, v_sex,
                make_date(2026 - 11 - g_grade[g], 1 + floor(random() * 12)::int, 1 + floor(random() * 28)::int), 'ACTIVE', 'Tuxtla Gutiérrez, Chiapas')
        returning id into v_id;
        stu_ids := stu_ids || v_id; stu_grp := stu_grp || g; stu_used := stu_used || false;
        -- Historial: ciclos anteriores de quienes ya van en 2.º y 3.º
        if g_grade[g] >= 2 then
            insert into student_enrollments (tenant_id, student_id, academic_year_id, grade, section, outcome)
            values (v_tenant, v_id, v_y2, (g_grade[g] - 1)::text, g_sec[g], 'PROMOVIDO');
        end if;
        if g_grade[g] = 3 then
            insert into student_enrollments (tenant_id, student_id, academic_year_id, grade, section, outcome)
            values (v_tenant, v_id, v_y1, '1', g_sec[g], 'PROMOVIDO');
        end if;
    end loop;

    -- 5. Madres, padres y tutores. Los 5 primeros tienen 3 o 2 hijos en grados distintos.
    for k in 1..25 loop
        if k % 3 = 0 then v_sex := 'Padre'; v_fn := nom_h[1 + ((k * 7) % 20)]; else v_sex := 'Madre'; v_fn := nom_m[1 + ((k * 7) % 20)]; end if;
        v_ap := apes[1 + ((k * 11) % 30)]; v_am := apes[1 + ((k * 5 + 3) % 30)];
        targets := case k when 1 then array[1,3,5] when 2 then array[2,4,6] when 3 then array[1,4] when 4 then array[2,5] when 5 then array[3,6]
                   else array[((k - 6) % 6) + 1] end;
        insert into profile_tenants (profile_id, tenant_id, role, is_default, first_name, last_name_paternal, last_name_maternal)
        values (v_tutors[k], v_tenant, 'TUTOR', true, v_fn, v_ap, v_am);
        update profiles set tenant_id = v_tenant, role = 'TUTOR', first_name = v_fn, last_name_paternal = v_ap, last_name_maternal = v_am,
               full_name = v_fn || ' ' || v_ap || ' ' || v_am, profile_setup_completed = true where id = v_tutors[k];
        kids := '[]'::jsonb;
        foreach g in array targets loop
            pick := null;
            for j in 1..50 loop if not stu_used[j] and stu_grp[j] = g then pick := j; exit; end if; end loop;
            if pick is null then for j in 1..50 loop if not stu_used[j] then pick := j; exit; end if; end loop; end if;
            stu_used[pick] := true;
            -- Los hijos llevan el apellido de la familia
            if v_sex = 'Padre' then update students set last_name_paternal = v_ap where id = stu_ids[pick];
            else update students set last_name_maternal = v_ap where id = stu_ids[pick]; end if;
            insert into guardians (student_id, tenant_id, first_name, last_name_paternal, last_name_maternal, relationship, email, phone,
                                   profile_id, user_id, access_role, access_status, linked_at)
            values (stu_ids[pick], v_tenant, v_fn, v_ap, v_am, v_sex, (select email from profiles where id = v_tutors[k]),
                    '961 555 ' || lpad((100 + k)::text, 4, '0'), v_tutors[k], v_tutors[k], 'TITULAR', 'ACTIVE', now());
            kids := kids || (select to_jsonb(s.first_name || ' ' || s.last_name_paternal || ' ' || coalesce(s.last_name_maternal, '') || ' (' || gr.grade || '° ' || gr.section || ')')
                             from students s join groups gr on gr.id = s.group_id where s.id = stu_ids[pick]);
        end loop;
        people := people || jsonb_build_object('id', v_tutors[k], 'kind', 'TUTOR', 'n', k, 'name', v_fn || ' ' || v_ap || ' ' || v_am, 'detail', v_sex, 'children', kids);
    end loop;

    -- CURP ficticia (con el formato correcto) para cada alumno
    with x as (select id, row_number() over (order by created_at, id) rn,
                      upper(translate(last_name_paternal, 'áéíóúÁÉÍÓÚñÑ ', 'aeiouAEIOUxX')) p,
                      upper(translate(coalesce(last_name_maternal, 'X'), 'áéíóúÁÉÍÓÚñÑ ', 'aeiouAEIOUxX')) m,
                      upper(translate(first_name, 'áéíóúÁÉÍÓÚñÑ ', 'aeiouAEIOUxX')) f, birth_date, gender
               from students where tenant_id = v_tenant)
    update students s set curp = substr(x.p, 1, 1) || coalesce(substring(substr(x.p, 2) from '[AEIOU]'), 'X') || substr(x.m, 1, 1) || substr(x.f, 1, 1)
            || to_char(x.birth_date, 'YYMMDD') || case when x.gender = 'HOMBRE' then 'H' else 'M' end || 'CS'
            || coalesce(substring(substr(x.p, 2) from '[^AEIOU]'), 'X') || coalesce(substring(substr(x.m, 2) from '[^AEIOU]'), 'X') || coalesce(substring(substr(x.f, 2) from '[^AEIOU]'), 'X')
            || 'A' || (x.rn % 10)::text
    from x where s.id = x.id;

    -- Cuenta de alumno (opcional): el primer alumno de 1.º A
    if v_stu_user is not null then
        select first_name, last_name_paternal, last_name_maternal into v_fn, v_ap, v_am from students where id = stu_ids[1];
        update students set user_id = v_stu_user, email = (select email from profiles where id = v_stu_user) where id = stu_ids[1];
        insert into profile_tenants (profile_id, tenant_id, role, is_default, first_name, last_name_paternal, last_name_maternal)
        values (v_stu_user, v_tenant, 'STUDENT', true, v_fn, v_ap, v_am);
        update profiles set tenant_id = v_tenant, role = 'STUDENT', first_name = v_fn, last_name_paternal = v_ap, last_name_maternal = v_am,
               full_name = v_fn || ' ' || v_ap || ' ' || coalesce(v_am, ''), profile_setup_completed = true where id = v_stu_user;
        people := people || jsonb_build_object('id', v_stu_user, 'kind', 'STUDENT', 'n', 1, 'name', v_fn || ' ' || v_ap || ' ' || coalesce(v_am, ''), 'detail', '1° A');
    end if;

    -- 6. Actividades y calificaciones (3 ya calificadas y 1 por entregar, en cada materia de cada grupo)
    insert into assignments (tenant_id, group_id, subject_id, title, description, due_date, start_date, type, weighting_percentage, criterion_id)
    select v_tenant, gs.group_id, gs.subject_catalog_id, a.title || ' · ' || initcap(sc.name), a.descr,
           date_trunc('day', now()) + make_interval(days => a.days, hours => 14), (current_date + a.days - 5), a.kind, a.w,
           (select ec.id from evaluation_criteria ec where ec.group_id = gs.group_id and ec.period_id = v_p1 and ec.name = a.crit)
    from group_subjects gs join subject_catalog sc on sc.id = gs.subject_catalog_id
    cross join (values
        ('Tarea 1: Cuestionario de repaso', 'Responder en el cuaderno las preguntas de la lección.', -21, 'HOMEWORK', 15, 'Tareas'),
        ('Proyecto: Mi comunidad', 'Producto del proyecto integrador del trimestre, en equipo.', -12, 'PROJECT', 30, 'Proyectos'),
        ('Examen del primer trimestre', 'Evaluación escrita de los contenidos vistos.', -4, 'EXAM', 40, 'Examen'),
        ('Tarea 2: Mapa conceptual', 'Elaborar un mapa conceptual del tema de la semana.', 4, 'HOMEWORK', 15, 'Tareas')
    ) a(title, descr, days, kind, w, crit)
    where gs.tenant_id = v_tenant;

    insert into grades (tenant_id, assignment_id, student_id, score, is_graded, graded_at, delivered_at, feedback)
    select v_tenant, a.id, s.id, round((5.5 + random() * 4.5)::numeric, 1), true, a.due_date + interval '1 day', a.due_date - interval '2 hours',
           case when random() < 0.15 then 'Buen trabajo; cuida la ortografía y la presentación.' end
    from assignments a join students s on s.group_id = a.group_id
    where a.tenant_id = v_tenant and a.due_date < now() and random() > 0.07;

    -- 7. Planeaciones didácticas: 2 por docente de asignatura (18), ligadas a su grupo, materia y periodo
    n := 0;
    for i in 1..9 loop
        for r in select gs.group_id, gs.subject_catalog_id, initcap(sc.name) sname, sc.field_of_study campo, gr.grade, gr.section
                 from group_subjects gs join subject_catalog sc on sc.id = gs.subject_catalog_id join groups gr on gr.id = gs.group_id
                 where gs.tenant_id = v_tenant and gs.teacher_id = v_teachers[i] order by gr.grade, gr.section, sc.name limit 2 loop
            n := n + 1;
            insert into lesson_plans (tenant_id, group_id, subject_id, period_id, title, temporality, start_date, end_date, campo_formativo, metodologia,
                problem_context, purpose, project_duration, objectives, contents, pda, ejes_articuladores, activities_sequence, resources, evaluation_plan, status)
            values (v_tenant, r.group_id, r.subject_catalog_id, v_p1,
                r.sname || ' ' || r.grade || '° ' || r.section || ': ' || (array['Cuidamos el agua de nuestra comunidad', 'Voces e historias de mi localidad', 'Alimentación saludable en la escuela'])[1 + (n % 3)],
                case when n % 3 = 0 then 'PROJECT' else 'WEEKLY' end, current_date - 7 + (n % 3) * 7, current_date - 3 + (n % 3) * 7 + case when n % 3 = 0 then 10 else 0 end,
                r.campo,
                case r.campo when 'Lenguajes' then 'Aprendizaje basado en proyectos comunitarios' when 'Saberes y Pensamiento Científico' then 'Aprendizaje basado en indagación (enfoque STEAM)'
                     when 'Ética, Naturaleza y Sociedades' then 'Aprendizaje basado en problemas' else 'Aprendizaje servicio' end,
                'En la comunidad se observa poco cuidado de los recursos y escasa participación de las familias en las actividades escolares.',
                'Que las y los estudiantes relacionen los contenidos de ' || r.sname || ' con una situación real de su comunidad y propongan acciones.',
                case when n % 3 = 0 then 10 else 5 end,
                jsonb_build_array('Identificar la problemática en su entorno inmediato.', 'Aplicar los contenidos de ' || r.sname || ' para explicarla.', 'Comunicar una propuesta de mejora.'),
                jsonb_build_array('Contenido del programa sintético de ' || r.sname || ' para ' || r.grade || '.º grado'),
                jsonb_build_array('Reconoce y explica la situación de su comunidad usando lo aprendido en ' || r.sname || '.'),
                jsonb_build_array('Pensamiento crítico', 'Vida saludable'),
                (select jsonb_agg(jsonb_build_object('date', (current_date - 7 + (n % 3) * 7 + s)::text, 'duration', 50, 'phases', jsonb_build_array(
                    jsonb_build_object('name', 'Inicio', 'duration', 10, 'activities', jsonb_build_array('Recuperar saberes previos con una pregunta detonadora.')),
                    jsonb_build_object('name', 'Desarrollo', 'duration', 30, 'activities', jsonb_build_array('Trabajo en equipos con el libro de texto y fuentes de la comunidad.', 'Registro de hallazgos en el cuaderno.')),
                    jsonb_build_object('name', 'Cierre', 'duration', 10, 'activities', jsonb_build_array('Puesta en común y acuerdos para la siguiente sesión.'))))) from generate_series(0, 2) s),
                array['Libro de texto', 'Cuaderno', 'Cartulinas y marcadores'],
                jsonb_build_object('instruments', jsonb_build_array('Lista de cotejo', 'Rúbrica del producto final'), 'criteria', jsonb_build_array('Participación', 'Producto', 'Trabajo en equipo')),
                (array['APPROVED', 'SUBMITTED', 'DRAFT'])[1 + (n % 3)]);
        end loop;
    end loop;

    -- 8. Programas analíticos: uno por campo formativo, con todas las disciplinas del campo
    for i in 1..4 loop
        select gs.teacher_id into v_creator from group_subjects gs join subject_catalog sc on sc.id = gs.subject_catalog_id
        where gs.tenant_id = v_tenant and sc.field_of_study = campos[i] order by gs.created_at, gs.id limit 1;
        continue when v_creator is null;
        select jsonb_agg(jsonb_build_object('contentId', 'demo-' || x.sid, 'contentName', 'Contenido prioritario de ' || x.sname || ' vinculado a la problemática de la comunidad',
                'subject_name', x.sname, 'field_of_study', campos[i], 'grades', jsonb_build_array(1, 2, 3),
                'pda_grade_1', 'Identifica la situación en su entorno desde ' || x.sname || '.',
                'pda_grade_2', 'Analiza causas y consecuencias usando ' || x.sname || '.',
                'pda_grade_3', 'Propone y argumenta alternativas de solución.',
                'methodology', 'Aprendizaje basado en proyectos comunitarios',
                'evaluation', 'Evaluación formativa con lista de cotejo y retroalimentación durante el proceso.',
                'timeframe', '2 semanas', 'axes', jsonb_build_array('Pensamiento crítico', 'Inclusión'),
                'community_link', 'Se relaciona con el cuidado del entorno y la convivencia en la localidad.', 'is_custom', true) order by x.sname)
          into items
          from (select distinct gs.subject_catalog_id sid, initcap(sc.name) sname from group_subjects gs join subject_catalog sc on sc.id = gs.subject_catalog_id
                where gs.tenant_id = v_tenant and sc.field_of_study = campos[i]) x;
        insert into analytical_programs (tenant_id, academic_year_id, field_of_study, status, created_by, diagnosis_context, school_data, group_diagnosis, problem_statements, program_by_fields)
        values (v_tenant, v_year, campos[i], case when i = 4 then 'DRAFT' else 'COMPLETED' end, v_creator,
            'Escuela urbana de turno matutino; las familias se dedican principalmente al comercio y a los servicios.',
            jsonb_build_object('name', 'Escuela Secundaria Técnica de Demostración "Rosario Castellanos"', 'cct', '07DST9990Z', 'shift', 'Matutino'),
            jsonb_build_object(
                'external_context', jsonb_build_object('geo', 'Zona urbana al centro de la ciudad.', 'social', 'Familias dedicadas al comercio y los servicios.', 'cultural', 'Fiestas patronales y tradiciones zoques.'),
                'internal_context', jsonb_build_object('infrastructure', '6 aulas, taller de tecnología y cancha.', 'resources', 'Biblioteca escolar y aula de medios.', 'environment', 'Ambiente de respeto y colaboración.'),
                'students', jsonb_build_object('characteristics', '50 estudiantes de 12 a 15 años.', 'needs', 'Fortalecer comprensión lectora y pensamiento matemático.', 'interests', 'Deporte, música y tecnología.'),
                'teachers', jsonb_build_object('strengths', 'Trabajo colegiado y disposición al cambio.', 'areas_opportunity', 'Evaluación formativa y proyectos interdisciplinarios.'),
                'narrative_final', 'La comunidad escolar identifica como prioridad el cuidado del entorno y la convivencia.'),
            jsonb_build_array(jsonb_build_object('id', 'p1', 'title', 'Poco cuidado del agua y de los espacios comunes', 'description', 'Se desperdicia agua y se acumulan residuos en la escuela y sus alrededores.')),
            jsonb_build_object('lenguajes', '[]'::jsonb, 'saberes', '[]'::jsonb, 'etica', '[]'::jsonb, 'humano', '[]'::jsonb) || jsonb_build_object(campo_key[i], coalesce(items, '[]'::jsonb)))
        returning id into v_prog;
        insert into analytical_program_contents (program_id, campo_formativo, subject_id, custom_content, justification, temporality, ejes_articuladores)
        select distinct v_prog, campos[i], gs.subject_catalog_id, 'Contenido prioritario de ' || initcap(sc.name) || ' vinculado a la problemática de la comunidad',
               'Responde a la problemática detectada en el diagnóstico.', '2 semanas', array['Pensamiento crítico', 'Inclusión']
        from group_subjects gs join subject_catalog sc on sc.id = gs.subject_catalog_id where gs.tenant_id = v_tenant and sc.field_of_study = campos[i];
    end loop;

    insert into demo_runs (tenant_id, user_ids, summary) values (v_tenant, v_all, jsonb_build_object('school', 'Escuela Secundaria Técnica de Demostración "Rosario Castellanos"'));

    return jsonb_build_object(
        'tenant_id', v_tenant, 'school', 'Escuela Secundaria Técnica de Demostración "Rosario Castellanos"', 'cct', '07DST9990Z',
        'counts', jsonb_build_object(
            'ciclos', (select count(*) from academic_years where tenant_id = v_tenant), 'grupos', (select count(*) from groups where tenant_id = v_tenant),
            'docentes', 10, 'alumnos', (select count(*) from students where tenant_id = v_tenant),
            'tutores', (select count(distinct user_id) from guardians where tenant_id = v_tenant), 'vinculos', (select count(*) from guardians where tenant_id = v_tenant),
            'materias_por_grupo', (select count(*) from group_subjects where tenant_id = v_tenant), 'actividades', (select count(*) from assignments where tenant_id = v_tenant),
            'calificaciones', (select count(*) from grades where tenant_id = v_tenant), 'planeaciones', (select count(*) from lesson_plans where tenant_id = v_tenant),
            'programas_analiticos', (select count(*) from analytical_programs where tenant_id = v_tenant)),
        'people', people);
end $$;

revoke all on function public.demo_seed(jsonb) from public, anon, authenticated;
grant execute on function public.demo_seed(jsonb) to service_role;
