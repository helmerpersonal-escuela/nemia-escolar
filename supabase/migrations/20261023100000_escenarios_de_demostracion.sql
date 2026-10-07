-- Escenarios para probar el sistema en la escuela de prueba: credenciales para entregar tareas, asistencia con
-- faltas y retardos, alumnos y docentes con dificultades, incidencias con seguimiento, diagnóstico y encuesta
-- capturados, bitácora de la dirección, visitas al aula, asistencia del personal, CTE, avisos y calendario.
-- Solo actúa sobre la escuela de prueba. Cada bloque se salta si ya tiene datos.

create or replace function public.demo_visit_records(p_base jsonb, p_pattern text, p_facts jsonb)
returns jsonb language sql immutable as $$
    select jsonb_agg(e.value || jsonb_build_object('source', coalesce(e.value->>'source', 'BASE'),
        'observed', case substr(p_pattern, e.ord::int, 1) when 'O' then 'OBSERVADO' when 'P' then 'PARCIAL' when 'N' then 'NO_OBSERVADO' when 'X' then 'NO_APLICA' end,
        'fact', coalesce(p_facts->>(e.value->>'id'), '')) order by e.ord)
    from jsonb_array_elements(p_base) with ordinality e(value, ord);
$$;
revoke all on function public.demo_visit_records(jsonb, text, jsonb) from public, anon, authenticated;

create or replace function public.demo_escenarios()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
    v uuid; v_year text; v_dir uuid; v_dirname text; v_period uuid;
    o uuid[]; p1 uuid; p2 uuid; p3 uuid; p4 uuid; p5 uuid; p6 uuid;
    t uuid[]; tn text[];
    v_inc uuid; v_inst uuid; v_ses uuid; g record; i int;
    done text[] := '{}';
    v_core uuid[];
    v_base jsonb := '[
      {"id":"pla1","area":"Planeación y programa analítico","text":"La sesión corresponde a la planeación didáctica entregada."},
      {"id":"pla2","area":"Planeación y programa analítico","text":"El contenido y el proceso de desarrollo de aprendizaje (PDA) trabajados son los del programa analítico de la escuela."},
      {"id":"pla3","area":"Planeación y programa analítico","text":"Se comunica al grupo qué se va a aprender y para qué."},
      {"id":"met1","area":"Metodología y actividades","text":"El trabajo parte de una situación o problema del contexto de las y los alumnos."},
      {"id":"met2","area":"Metodología y actividades","text":"Se trabaja con una metodología sociocrítica (proyectos comunitarios, indagación STEAM, aprendizaje basado en problemas o aprendizaje servicio)."},
      {"id":"met3","area":"Metodología y actividades","text":"Las actividades piden a las y los alumnos investigar, producir o resolver, no solo copiar o escuchar."},
      {"id":"met4","area":"Metodología y actividades","text":"Se relaciona lo trabajado con otros campos formativos o con algún eje articulador."},
      {"id":"par1","area":"Participación de las y los estudiantes","text":"Las y los alumnos hacen preguntas o dan su opinión durante la sesión."},
      {"id":"par2","area":"Participación de las y los estudiantes","text":"Hay momentos de trabajo en equipo o entre pares."},
      {"id":"par3","area":"Participación de las y los estudiantes","text":"Participan alumnos distintos, no siempre los mismos."},
      {"id":"inc1","area":"Inclusión y ambiente del aula","text":"Hay ajustes o apoyos para alumnos que enfrentan barreras para el aprendizaje y la participación."},
      {"id":"inc2","area":"Inclusión y ambiente del aula","text":"El trato entre docente y alumnos, y entre alumnos, es respetuoso."},
      {"id":"inc3","area":"Inclusión y ambiente del aula","text":"El acomodo del salón permite que todas y todos vean, escuchen y participen."},
      {"id":"eva1","area":"Evaluación formativa","text":"Se revisa lo que el grupo ya sabe antes de avanzar."},
      {"id":"eva2","area":"Evaluación formativa","text":"Las y los alumnos reciben comentarios sobre su trabajo durante la sesión."},
      {"id":"eva3","area":"Evaluación formativa","text":"Se usa algún instrumento o registro (rúbrica, lista de cotejo, observación) para dar seguimiento."},
      {"id":"rec1","area":"Recursos y tiempo","text":"Se usan los libros de texto gratuitos u otros materiales al alcance del grupo."},
      {"id":"rec2","area":"Recursos y tiempo","text":"La sesión inicia y termina en el horario, con inicio, desarrollo y cierre."}]';
    v_socio jsonb := '[
      {"id":"s01","topic":"Autoconocimiento","text":"Puedo decir con palabras cómo me siento."},
      {"id":"s02","topic":"Autoconocimiento","text":"Sé en qué cosas soy bueno o buena."},
      {"id":"s03","topic":"Autoconocimiento","text":"Me siento a gusto con mi forma de ser."},
      {"id":"s04","topic":"Autoconocimiento","text":"Me cuesta trabajo saber qué me pasa cuando estoy mal.","reverse":true},
      {"id":"s05","topic":"Autorregulación","text":"Cuando me enojo, logro calmarme antes de actuar."},
      {"id":"s06","topic":"Autorregulación","text":"Termino mis tareas aunque me cuesten trabajo."},
      {"id":"s07","topic":"Autorregulación","text":"Puedo esperar mi turno sin desesperarme."},
      {"id":"s08","topic":"Autorregulación","text":"Hago o digo cosas de las que después me arrepiento.","reverse":true},
      {"id":"s09","topic":"Autonomía","text":"Tomo decisiones pensando en lo que puede pasar después."},
      {"id":"s10","topic":"Autonomía","text":"Pido ayuda cuando la necesito."},
      {"id":"s11","topic":"Autonomía","text":"Me organizo para cumplir con mis responsabilidades."},
      {"id":"s12","topic":"Autonomía","text":"Siento que puedo lograr lo que me propongo."},
      {"id":"s13","topic":"Empatía","text":"Me doy cuenta cuando un compañero o compañera está triste."},
      {"id":"s14","topic":"Empatía","text":"Respeto a las personas aunque piensen distinto que yo."},
      {"id":"s15","topic":"Empatía","text":"Ayudo a quien lo necesita sin que me lo pidan."},
      {"id":"s16","topic":"Empatía","text":"Me siento parte de mi grupo."},
      {"id":"s17","topic":"Colaboración","text":"Trabajo bien en equipo."},
      {"id":"s18","topic":"Colaboración","text":"Escucho las ideas de los demás antes de dar la mía."},
      {"id":"s19","topic":"Colaboración","text":"Resuelvo los problemas con mis compañeros platicando."},
      {"id":"s20","topic":"Colaboración","text":"En mi casa hay alguien con quien puedo hablar de lo que me pasa."}]';
    v_diag jsonb := '[
      {"id":"d01","topic":"Números y operaciones","text":"Calcula: 348 + 275","answer":"623"},
      {"id":"d02","topic":"Números y operaciones","text":"Calcula: 1 000 − 386","answer":"614"},
      {"id":"d03","topic":"Números y operaciones","text":"Calcula: 24 × 15","answer":"360"},
      {"id":"d04","topic":"Números y operaciones","text":"Una caja tiene 12 lápices. ¿Cuántos lápices hay en 9 cajas?","answer":"108"},
      {"id":"d05","topic":"Fracciones","text":"¿Qué fracción es mayor: 3/4 o 2/3?","answer":"3/4"},
      {"id":"d06","topic":"Fracciones","text":"Calcula: 1/2 + 1/4","answer":"3/4"},
      {"id":"d07","topic":"Fracciones","text":"Escribe 0.25 como fracción.","answer":"1/4"},
      {"id":"d08","topic":"Geometría","text":"Perímetro de un rectángulo de 8 cm por 5 cm.","answer":"26 cm"},
      {"id":"d09","topic":"Geometría","text":"Área de un triángulo de base 10 cm y altura 6 cm.","answer":"30 cm²"},
      {"id":"d10","topic":"Geometría","text":"¿Cuánto suman los ángulos interiores de un triángulo?","answer":"180°"}]';
begin
    if coalesce(auth.role(), '') <> 'service_role' and session_user not in ('postgres', 'supabase_admin') then
        raise exception 'Solo el servidor puede completar la escuela de prueba';
    end if;
    select tenant_id into v from demo_runs order by created_at desc limit 1;
    if v is null or not exists (select 1 from tenants where id = v and cct = '07DST9990Z') then
        return jsonb_build_object('success', false, 'error', 'No hay escuela de prueba');
    end if;
    select name into v_year from academic_years where tenant_id = v and is_active limit 1;
    v_year := coalesce(v_year, '2026-2027');
    select id into v_period from evaluation_periods where tenant_id = v and is_active limit 1;
    select profile_id, concat_ws(' ', first_name, last_name_paternal) into v_dir, v_dirname from profile_tenants where tenant_id = v and role = 'DIRECTOR' order by created_at limit 1;
    select array_agg(s.id order by gg.grade, gg.section, s.last_name_paternal, s.first_name, s.id) into o
        from students s join groups gg on gg.id = s.group_id where s.tenant_id = v;
    select array_agg(x.profile_id order by x.nm), array_agg(x.nm order by x.nm) into t, tn
        from (select profile_id, concat_ws(' ', first_name, last_name_paternal) nm from profile_tenants where tenant_id = v and role = 'TEACHER') x;
    if coalesce(array_length(o, 1), 0) < 46 or coalesce(array_length(t, 1), 0) < 6 then
        return jsonb_build_object('success', false, 'error', 'La escuela de prueba no tiene los alumnos o docentes esperados');
    end if;
    -- Alumnos con dificultades: p1 reprobación y conducta; p2 reprobación y falta grave; p3 inasistencias;
    -- p4 una materia reprobada; p5 socioemocional; p6 socioemocional y diagnóstico (primer grado)
    p1 := o[1]; p6 := o[2]; p2 := o[12]; p3 := o[23]; p4 := o[34]; p5 := o[45];
    select array_agg(distinct gs.subject_catalog_id) into v_core from group_subjects gs join subject_catalog sc on sc.id = gs.subject_catalog_id
        where gs.tenant_id = v and (sc.name ilike 'Matem%' or sc.name ilike 'Espa%');

    -- 1. Credenciales: código de lector DEMO001… (se puede teclear para simular la credencial)
    if not exists (select 1 from student_cards where tenant_id = v and code like 'DEMO%') then
        insert into student_cards (tenant_id, student_id, code, kind, created_by)
        select v, x.id, 'DEMO' || lpad(x.ord::text, 3, '0'), 'READER', v_dir from unnest(o) with ordinality x(id, ord)
        on conflict do nothing;
        done := array_append(done, 'credenciales');
    end if;

    -- 2. Asistencia con faltas, retardos y justificadas; p3 falta seguido
    if not exists (select 1 from attendance where tenant_id = v and status <> 'PRESENT') then
        insert into attendance (tenant_id, group_id, student_id, date, status)
        select v, st.group_id, st.id, dd::date, 'PRESENT'
        from students st cross join generate_series((select coalesce(max(date), current_date - 21) + 1 from attendance where tenant_id = v), current_date - 1, interval '1 day') dd
        where st.tenant_id = v and st.group_id is not null and extract(isodow from dd) < 6
        on conflict do nothing;
        update attendance a set status = case
                when a.student_id = p3 and abs(hashtext(a.date::text)) % 100 < 45 then 'ABSENT'
                when a.student_id = p1 and abs(hashtext(a.date::text || 'r')) % 100 < 30 then 'LATE'
                when h < 4 then 'ABSENT' when h < 8 then 'LATE' when h < 9 then 'EXCUSED' else 'PRESENT' end,
            notes = case when h = 8 then 'Justificante entregado' end
        from (select id, abs(hashtext(student_id::text || date::text)) % 100 h from attendance where tenant_id = v) x
        where x.id = a.id;
        done := array_append(done, 'asistencia');
    end if;

    -- 3. Calificaciones: p1 y p2 reprueban Matemáticas y Español; p4 solo Matemáticas; p3 dejó de entregar
    if not exists (select 1 from assignments where tenant_id = v and title like '%con credencial%') then
        update grades gr set score = 4 + (abs(hashtext(gr.id::text)) % 16) / 10.0, feedback = 'Necesita apoyo; revisar con su familia.'
        from assignments a where a.id = gr.assignment_id and gr.tenant_id = v and gr.student_id in (p1, p2) and a.subject_id = any(v_core);
        update grades gr set score = 4.5 + (abs(hashtext(gr.id::text)) % 11) / 10.0
        from assignments a join subject_catalog sc on sc.id = a.subject_id where a.id = gr.assignment_id and gr.tenant_id = v and gr.student_id = p4 and sc.name ilike 'Matem%';
        update grades gr set score = null, is_graded = false, delivered_at = null, graded_at = null
        from assignments a where a.id = gr.assignment_id and gr.tenant_id = v and gr.student_id = p3 and a.type = 'HOMEWORK' and a.due_date > now() - interval '15 days';
        -- Tarea abierta en cada grupo para probar la entrega con credencial: la mitad ya la entregó, nadie está calificado
        for g in select gs.group_id, gs.subject_catalog_id sid from group_subjects gs join subject_catalog sc on sc.id = gs.subject_catalog_id
                 where gs.tenant_id = v and sc.name ilike 'Matem%' loop
            insert into assignments (tenant_id, group_id, subject_id, title, description, due_date, start_date, type, criterion_id, weighting_percentage)
            select v, g.group_id, g.sid, 'Tarea 5: problemas de la semana (entrega con credencial)', 'Resolver los cinco problemas del cuaderno. Se entrega pasando la credencial.',
                   (current_date + 1)::timestamptz + interval '14 hours', current_date - 2, 'HOMEWORK',
                   (select criterion_id from assignments where group_id = g.group_id and subject_id = g.sid and type = 'HOMEWORK' and criterion_id is not null limit 1),
                   (select weighting_percentage from assignments where group_id = g.group_id and subject_id = g.sid and type = 'HOMEWORK' limit 1)
            returning id into v_inc;
            insert into grades (tenant_id, assignment_id, student_id, is_graded, delivered_at)
            select v, v_inc, st.id, false, now() - interval '3 hours' from students st
            where st.group_id = g.group_id and abs(hashtext(st.id::text)) % 2 = 0 and st.id <> p3;
        end loop;
        done := array_append(done, 'calificaciones y tarea con credencial');
    end if;

    -- 4. Incidencias con relato, medidas, acuerdos, avances y hojas apartadas
    if not exists (select 1 from incident_followups where tenant_id = v) then
        update student_incidents set catalog_item = title where tenant_id = v and catalog_item is null;
        insert into incident_catalog (tenant_id, name, type, severity, measure, created_by) values
            (v, 'Vendió productos dentro del plantel', 'CONDUCTA', 'BAJA', 'Diálogo con el alumno y aviso a la familia.', v_dir),
            (v, 'No portó la credencial', 'CONDUCTA', 'BAJA', 'Registro y aviso a su asesor.', v_dir)
        on conflict do nothing;
        for i in 1..3 loop
            insert into student_incidents (tenant_id, student_id, teacher_id, type, severity, title, catalog_item, description, action_taken, place, involved, status, occurred_at, created_at, has_commitment, agreements)
            values (v, p1, t[i], 'CONDUCTA', case when i = 3 then 'MEDIA' else 'BAJA' end,
                (array['Interrumpió la clase de forma reiterada', 'Uso del celular durante la clase', 'Faltó al respeto a un compañero'])[i],
                (array['Interrumpió la clase de forma reiterada', 'Uso del celular durante la clase', 'Faltó al respeto a un compañero'])[i],
                (array['Se levantó de su lugar cuatro veces durante la explicación y habló en voz alta con dos compañeros.', 'Sacó el celular durante el ejercicio después de dos avisos; lo guardó al tercero.', 'En el receso le puso un apodo a un compañero frente a otros tres alumnos; el compañero se retiró llorando.'])[i],
                (array['Diálogo al terminar la clase.', 'Resguardo del equipo y entrega a la salida.', 'Mediación entre ambos y citatorio a la familia.'])[i],
                (array['Salón', 'Salón', 'Patio'])[i], case when i = 3 then 'Un compañero de su grupo; lo vieron tres alumnos.' end,
                'OPEN', now() - make_interval(days => 26 - i * 8), now() - make_interval(days => 26 - i * 8), i = 3,
                case when i = 3 then jsonb_build_array(
                    jsonb_build_object('id', 'dm1', 'text', 'Ofrecer una disculpa a su compañero', 'responsible', 'Alumno', 'due_date', (current_date - 1)::text, 'done_at', (current_date - 1)::text),
                    jsonb_build_object('id', 'dm2', 'text', 'Revisar en casa el reglamento de convivencia y firmarlo', 'responsible', 'Familia', 'due_date', (current_date - 1)::text, 'done_at', null),
                    jsonb_build_object('id', 'dm3', 'text', 'Reporte semanal de conducta de su asesor', 'responsible', 'Asesor del grupo', 'due_date', (current_date + 7)::text, 'done_at', null))
                else '[]'::jsonb end)
            returning id into v_inc;
        end loop;
        insert into incident_followups (tenant_id, incident_id, note, progress, created_by, author_name, created_at) values
            (v, v_inc, 'Ofreció la disculpa frente a su asesor. El compañero la aceptó.', 'EN_PROCESO', v_dir, v_dirname, now() - interval '1 day'),
            (v, v_inc, 'La familia no ha devuelto el reglamento firmado. Se envió recordatorio.', 'SIN_AVANCE', v_dir, v_dirname, now() - interval '2 hours');
        insert into student_incidents (tenant_id, student_id, teacher_id, type, severity, title, catalog_item, description, action_taken, place, involved, status, occurred_at, created_at, has_commitment, agreements)
        values (v, p2, t[4], 'CONDUCTA', 'ALTA', 'Agresión física a un compañero', 'Agresión física a un compañero',
            'A la salida del taller empujó a un compañero contra la pared después de una discusión por un balón. El compañero se raspó el codo.',
            'Se separó a los dos, se atendió el raspón en la dirección y se llamó a ambas familias el mismo día.', 'Pasillo de talleres', 'Un compañero de otro grupo; presenció el prefecto.',
            'OPEN', now() - interval '6 days', now() - interval '6 days', true, jsonb_build_array(
                jsonb_build_object('id', 'dm4', 'text', 'Asistir a tres sesiones de mediación con su asesor', 'responsible', 'Alumno y asesor', 'due_date', (current_date + 10)::text, 'done_at', null),
                jsonb_build_object('id', 'dm5', 'text', 'La familia acude a firmar la carta compromiso', 'responsible', 'Familia', 'due_date', (current_date - 3)::text, 'done_at', null)))
        returning id into v_inc;
        insert into incident_followups (tenant_id, incident_id, note, progress, created_by, author_name, created_at) values
            (v, v_inc, 'Primera sesión de mediación realizada. Reconoció lo ocurrido.', 'EN_PROCESO', v_dir, v_dirname, now() - interval '3 days');
        insert into student_citations (tenant_id, student_id, incident_id, reason, meeting_date, meeting_time, status, requested_by)
        values (v, p2, v_inc, 'Firmar la carta compromiso y acordar el seguimiento.', current_date + 2, '08:00', 'PENDING', v_dir);
        insert into student_incidents (tenant_id, student_id, teacher_id, type, severity, title, catalog_item, description, action_taken, place, status, occurred_at, created_at)
        values (v, p5, t[5], 'EMOCIONAL', 'MEDIA', 'Se le observa triste o aislado', 'Se le observa triste o aislado',
            'Lleva una semana sin integrarse a los equipos; en el receso se queda en el salón. Dijo que no tiene ganas de salir.',
            'Entrevista con quien asesora al grupo y aviso a la familia.', 'Salón', 'OPEN', now() - interval '4 days', now() - interval '4 days'),
           (v, o[8], t[6], 'POSITIVO', 'BAJA', 'Apoyó a sus compañeros', 'Apoyó a sus compañeros',
            'Explicó el procedimiento a su equipo y los ayudó a terminar el proyecto a tiempo.', 'Reconocimiento ante el grupo.', 'Salón', 'RESOLVED', now() - interval '2 days', now() - interval '2 days');
        for i in 1..3 loop
            insert into incident_blank_folios (tenant_id, folio, reserved_by) values (v, next_folio(v, 'INCIDENCIA'), v_dir);
        end loop;
        done := array_append(done, 'incidencias');
    end if;

    -- 5. Encuesta socioemocional (toda la escuela) y diagnóstico de Matemáticas de primer grado, ya capturados
    if not exists (select 1 from school_instruments where tenant_id = v) then
        insert into school_instruments (tenant_id, school_year, kind, title, instructions, items, status, created_by)
        values (v, v_year, 'SOCIOEMOCIONAL', 'Encuesta socioemocional de inicio de ciclo', 'No hay respuestas buenas ni malas. Contesta con sinceridad; lo que marques sirve para que tu escuela te acompañe mejor.', v_socio, 'PUBLISHED', v_dir)
        returning id into v_inst;
        insert into instrument_results (tenant_id, instrument_id, student_id, group_id, answers, captured_by)
        select v, v_inst, st.id, st.group_id, (
            select jsonb_object_agg(it->>'id', case when coalesce((it->>'reverse')::boolean, false) then 5 - f.val else f.val end)
            from jsonb_array_elements(v_socio) it,
            lateral (select case
                when st.id = p5 then 1 + abs(hashtext(st.id::text || (it->>'id'))) % 2
                when st.id = p6 and it->>'topic' in ('Autorregulación', 'Colaboración') then 1 + abs(hashtext(st.id::text || (it->>'id'))) % 2
                when st.id = p1 and it->>'topic' = 'Autorregulación' then 1 + abs(hashtext(st.id::text || (it->>'id'))) % 2
                when abs(hashtext(st.id::text || (it->>'topic'))) % 9 = 0 then 2 + abs(hashtext(st.id::text || (it->>'id'))) % 2
                else 3 + abs(hashtext(st.id::text || (it->>'id'))) % 2 end val) f), v_dir
        from students st where st.tenant_id = v and st.group_id is not null and st.id is distinct from o[50];

        insert into school_instruments (tenant_id, school_year, kind, title, grade, subject, instructions, items, status, created_by)
        values (v, v_year, 'DIAGNOSTICO', 'Examen diagnóstico de Matemáticas', '1', 'Matemáticas', 'Resuelve cada ejercicio y anota tu respuesta en la línea. Puedes usar el reverso para tus operaciones.', v_diag, 'PUBLISHED', v_dir)
        returning id into v_inst;
        insert into instrument_results (tenant_id, instrument_id, student_id, group_id, answers, absent, captured_by)
        select v, v_inst, st.id, st.group_id,
            case when st.id = o[5] then '{}'::jsonb else (
                select jsonb_object_agg(it->>'id', case when abs(hashtext(st.id::text || (it->>'id'))) % 100 <
                    case when st.id in (p1, p6) then 30 when it->>'topic' = 'Fracciones' then 45 else 82 end then 1 else 0 end)
                from jsonb_array_elements(v_diag) it) end,
            st.id = o[5], v_dir
        from students st join groups gg on gg.id = st.group_id where st.tenant_id = v and gg.grade::text = '1' and st.id is distinct from o[7];
        done := array_append(done, 'diagnóstico y encuesta');
    end if;

    -- 6. Bitácora de la dirección
    if not exists (select 1 from direction_log where tenant_id = v) then
        insert into direction_log (tenant_id, kind, area, occurred_at, attendees, student_id, teacher_id, subject, facts, agreements, next_date, status, created_by, author_name) values
        (v, 'REUNION_FAMILIA', 'DIRECCION', now() - interval '5 days', 'Madre de familia', p2, null, 'Agresión a un compañero y bajo rendimiento',
            'Se informó lo ocurrido el día del incidente y las calificaciones del trimestre. La madre comentó que por las tardes cuida a sus hermanos y no tiene horario para tareas.',
            jsonb_build_array(
                jsonb_build_object('id', 'dl1', 'text', 'Establecer en casa un horario de tareas de 5 a 6 de la tarde', 'responsible', 'Familia', 'due_date', (current_date - 2)::text, 'done_at', (current_date - 2)::text),
                jsonb_build_object('id', 'dl2', 'text', 'Entregar los trabajos pendientes de Matemáticas y Español', 'responsible', 'Alumno', 'due_date', (current_date - 1)::text, 'done_at', null),
                jsonb_build_object('id', 'dl3', 'text', 'Reunión de revisión con la familia', 'responsible', 'Dirección', 'due_date', (current_date + 9)::text, 'done_at', null)),
            current_date + 9, 'ABIERTO', v_dir, v_dirname),
        (v, 'ATENCION', 'SUBDIRECCION', now() - interval '3 days', 'Padre de una alumna de 2° A', null, null, 'Reposición de credencial extraviada',
            'El padre informó que la alumna perdió su credencial. Se le explicó el trámite y se pidió la reposición a control escolar.', '[]'::jsonb, null, 'CERRADO', v_dir, v_dirname),
        (v, 'SEGUIMIENTO_DOCENTE', 'DIRECCION', now() - interval '7 days', tn[2], null, t[2], 'Planeaciones sin entregar e inasistencias',
            'Tiene tres inasistencias en las últimas dos semanas y sus planeaciones siguen en borrador. Explicó que atiende un asunto familiar y que no ha podido avanzar.',
            jsonb_build_array(
                jsonb_build_object('id', 'dl4', 'text', 'Entregar las planeaciones del primer trimestre', 'responsible', tn[2], 'due_date', (current_date - 2)::text, 'done_at', null),
                jsonb_build_object('id', 'dl5', 'text', 'Avisar con un día de anticipación cuando vaya a faltar y dejar actividades', 'responsible', tn[2], 'due_date', (current_date + 14)::text, 'done_at', null),
                jsonb_build_object('id', 'dl6', 'text', 'Acompañamiento en la planeación del siguiente proyecto', 'responsible', 'Coordinación académica', 'due_date', (current_date + 5)::text, 'done_at', null)),
            current_date + 5, 'ABIERTO', v_dir, v_dirname),
        (v, 'SEGUIMIENTO_ALUMNO', 'COORDINACION', now() - interval '2 days', 'Alumno y su asesor', p1, null, 'Seguimiento por reprobación y conducta',
            'Promedio reprobatorio en Matemáticas y Español y tres incidencias de conducta en el mes. Dijo que no entiende las fracciones y que se aburre.',
            jsonb_build_array(
                jsonb_build_object('id', 'dl7', 'text', 'Asesoría de Matemáticas martes y jueves en la séptima hora', 'responsible', 'Docente de Matemáticas', 'due_date', (current_date + 12)::text, 'done_at', null),
                jsonb_build_object('id', 'dl8', 'text', 'Cambio de lugar al frente del salón', 'responsible', 'Asesor del grupo', 'due_date', (current_date - 1)::text, 'done_at', (current_date - 1)::text)),
            current_date + 12, 'ABIERTO', v_dir, v_dirname);
        done := array_append(done, 'bitácora de la dirección');
    end if;

    -- 7. Visitas al aula: una cerrada, una con acuerdos vencidos, una por retroalimentar y una programada
    if not exists (select 1 from classroom_visits where tenant_id = v) then
        insert into visit_indicators (tenant_id, area, text, source, created_by) values (v, 'Recursos y tiempo', 'Se dedica un tiempo a la lectura en voz alta.', 'AUTORIDAD', v_dir);
        insert into classroom_visits (tenant_id, teacher_id, group_id, subject, scheduled_date, scheduled_time, purpose, status, observer_id, observer_name, indicators, facts, feedback_date, teacher_comment, agreements, next_review, teacher_note, teacher_note_at)
        select v, x.tid, (select group_id from group_subjects where tenant_id = v and teacher_id = x.tid order by id limit 1),
               (select sc.name from group_subjects gs join subject_catalog sc on sc.id = gs.subject_catalog_id where gs.tenant_id = v and gs.teacher_id = x.tid order by gs.id limit 1),
               x.dt, x.tm, x.purpose, x.status, v_dir, v_dirname,
               case when x.pattern is null then demo_visit_records(v_base, '', '{}') else demo_visit_records(v_base, x.pattern, x.facts) end,
               x.other, x.fdate, x.comment, x.agreements, x.review, x.note, case when x.note is not null then now() - interval '1 day' end
        from (values
            (t[1], current_date - 16, '08:40'::time, 'Acompañar el trabajo por proyectos del primer trimestre.', 'CERRADA', 'OOOOOOPOOOXOOOOOOO',
                '{"pla3":"El propósito estaba escrito en el pizarrón y lo leyó una alumna al inicio.","met1":"El proyecto parte del consumo de agua en las casas de los alumnos.","par2":"Trabajaron en seis equipos de cuatro durante 25 minutos.","eva3":"Usó una lista de cotejo por equipo."}'::jsonb,
                'Ocho alumnos distintos pasaron a explicar su avance.', current_date - 14, 'Comentó que quiere mejorar el cierre de la sesión porque se le acaba el tiempo.',
                jsonb_build_array(jsonb_build_object('id', 'va1', 'text', 'Reservar los últimos cinco minutos para el cierre', 'responsible', tn[1], 'due_date', (current_date - 7)::text, 'done_at', (current_date - 7)::text)),
                null::date, 'Me sirvió ver el registro por equipos. Ya dejo cinco minutos para el cierre.'),
            (t[2], current_date - 9, '09:50'::time, 'Acordada en el seguimiento: revisar la relación entre la planeación y la clase.', 'RETROALIMENTADA', 'NNNNNPNPNNXOPNNNPN',
                '{"pla1":"No había planeación entregada de la semana; la actividad se dictó del libro.","pla3":"La sesión inició con el dictado sin mencionar qué se iba a aprender.","met3":"Durante 30 minutos el grupo copió un texto del pizarrón.","par1":"Dos alumnos preguntaron; los demás no intervinieron.","par3":"Las tres participaciones fueron de los mismos dos alumnos.","eva2":"No hubo revisión de cuadernos ni comentarios durante la sesión.","rec2":"La clase inició doce minutos después del timbre."}'::jsonb,
                'Cinco alumnos de la última fila no tenían el libro.', current_date - 8, 'Dijo que no alcanzó a planear por sus ausencias y que el grupo se le dificulta después del receso.',
                jsonb_build_array(
                    jsonb_build_object('id', 'va2', 'text', 'Entregar la planeación semanal los viernes', 'responsible', tn[2], 'due_date', (current_date - 3)::text, 'done_at', null),
                    jsonb_build_object('id', 'va3', 'text', 'Iniciar cada sesión anunciando el propósito', 'responsible', tn[2], 'due_date', (current_date + 4)::text, 'done_at', null),
                    jsonb_build_object('id', 'va4', 'text', 'Observar una clase de un compañero que trabaja por proyectos', 'responsible', 'Coordinación académica', 'due_date', (current_date + 6)::text, 'done_at', null)),
                current_date + 6, null),
            (t[3], current_date - 2, '07:50'::time, 'Visita de inicio de ciclo.', 'REALIZADA', 'OOPOPOXOOPNOOPOPON',
                '{"pla3":"Mencionó el tema, no el propósito.","met2":"Usó un problema del libro; no se relacionó con un proyecto.","inc1":"Un alumno con anteojos rotos estaba sentado al fondo y no copiaba.","rec2":"La sesión inició ocho minutos tarde; no hubo cierre."}'::jsonb,
                null, null::date, null, '[]'::jsonb, null::date, null),
            (t[4], current_date + 5, '10:40'::time, 'Visita de inicio de ciclo, acordada con anticipación.', 'PROGRAMADA', null, '{}'::jsonb, null, null::date, null, '[]'::jsonb, null::date, null)
        ) x(tid, dt, tm, purpose, status, pattern, facts, other, fdate, comment, agreements, review, note);
        done := array_append(done, 'visitas al aula');
    end if;

    -- 8. Personal: asistencia de dos semanas (t2 falta, t3 llega tarde), ausencias, permiso y planeaciones en borrador
    if not exists (select 1 from staff_attendance where tenant_id = v) then
        insert into staff_attendance (profile_id, tenant_id, date, status, check_in, check_out, notes)
        select x.pid, v, dd::date, x.st,
               case when x.st = 'ABSENT' then null else dd + case when x.st = 'LATE' then interval '13 hours 22 minutes' else interval '12 hours 50 minutes' end end,
               case when x.st = 'ABSENT' then null else dd + interval '19 hours 15 minutes' end,
               case when x.st = 'ABSENT' then 'Sin aviso' end
        from generate_series(current_date - 14, current_date - 1, interval '1 day') dd
        cross join lateral (select pid, case
                when pid = t[2] and abs(hashtext(dd::text)) % 10 < 3 then 'ABSENT'
                when pid = t[3] and abs(hashtext(dd::text || 'l')) % 10 < 4 then 'LATE'
                when abs(hashtext(pid::text || dd::text)) % 40 = 0 then 'LATE' else 'PRESENT' end st
            from unnest(t) pid) x
        where extract(isodow from dd) < 6
        on conflict do nothing;
        insert into teacher_absences (tenant_id, profile_id, start_date, end_date, reason, status) values
            (v, t[2], current_date - 4, current_date - 4, 'Asunto familiar', 'RESOLVED'),
            (v, t[2], current_date + 1, current_date + 1, 'Cita médica', 'PENDING'),
            (v, t[5], current_date + 3, current_date + 4, 'Comisión sindical', 'APPROVED');
        insert into staff_permits (profile_id, tenant_id, start_date, end_date, reason, status) values
            (t[6], v, current_date + 6, current_date + 6, 'Trámite personal', 'PENDING');
        update lesson_plans lp set status = 'DRAFT' from group_subjects gs
        where lp.tenant_id = v and gs.group_id = lp.group_id and gs.subject_catalog_id = lp.subject_id and gs.teacher_id = t[2] and lp.status <> 'DRAFT';
        done := array_append(done, 'personal');
    end if;

    -- 9. Apoyo a alumnos
    if not exists (select 1 from student_tracking where tenant_id = v) then
        insert into student_tracking (tenant_id, student_id, created_by, type, status, severity, title, description, agreements) values
            (v, p5, v_dir, 'ENTREVISTA', 'EN_PROCESO', 'MEDIA', 'Entrevista por aislamiento', 'Comentó que se cambió de casa hace un mes y que extraña a sus amistades de la primaria.', 'Asignarle un equipo fijo y revisar en dos semanas.'),
            (v, p3, v_dir, 'VISITA_DOMICILIARIA', 'ABIERTO', 'ALTA', 'Inasistencias frecuentes', 'Acumula varias faltas en el mes. La familia no contesta el teléfono registrado.', 'Visita al domicilio con trabajo social.'),
            (v, p2, v_dir, 'SEGUIMIENTO', 'ABIERTO', 'ALTA', 'Seguimiento por agresión', 'Ver incidencia y reunión con la familia en la bitácora de la dirección.', 'Tres sesiones de mediación.');
        insert into student_bap_records (tenant_id, student_id, barrier_type, diagnosis, adjustments, follow_up_notes)
        values (v, p6, 'Aprendizaje', 'Dificultad en lectura de comprensión detectada en el diagnóstico (dato de ejemplo).',
            '["Instrucciones por escrito y en pasos cortos", "Tiempo adicional en evaluaciones", "Trabajo con un compañero monitor"]'::jsonb, 'Revisar avances al cierre del trimestre.')
        on conflict do nothing;
        done := array_append(done, 'seguimiento y apoyo');
    end if;

    -- 10. Vida escolar: avisos, calendario, CTE y solicitudes
    if not exists (select 1 from cte_sessions where tenant_id = v) then
        insert into school_announcements (tenant_id, sender_id, title, content, target_roles, send_email) values
            (v, v_dir, 'Entrega de boletas del primer trimestre', 'La entrega de boletas será en el salón de cada grupo. Favor de asistir con identificación.', array['TUTOR'], false),
            (v, v_dir, 'Captura de la encuesta socioemocional', 'Recuerden capturar la encuesta de su grupo antes del viernes.', array['TEACHER'], false);
        insert into calendar_events (tenant_id, title, description, start_date, end_date, type, is_official_sep, is_direction) values
            (v, 'Consejo Técnico Escolar', 'Segunda sesión ordinaria.', current_date + 16, current_date + 16, 'direction', true, true),
            (v, 'Entrega de boletas', 'Primer trimestre.', current_date + 24, current_date + 24, 'direction', false, true),
            (v, 'Simulacro de protección civil', 'Participa toda la escuela a las 10:00.', current_date + 8, current_date + 8, 'direction', false, true);
        insert into cte_sessions (tenant_id, school_year, session_type, session_number, date, title, status, purpose, minutes, created_by, agenda)
        values (v, v_year, 'ORDINARIA', 1, current_date - 12, 'Primera sesión ordinaria', 'DONE', 'Revisar los resultados del diagnóstico y acordar el acompañamiento a alumnos en riesgo.',
            'Se revisaron los resultados del diagnóstico por grado. El tema más bajo en primero fue fracciones.', v_dir,
            '[{"hora":"08:00","tema":"Resultados del diagnóstico","responsable":"Coordinación","duracion_min":60},{"hora":"09:00","tema":"Alumnos en riesgo","responsable":"Dirección","duracion_min":45},{"hora":"10:15","tema":"Acuerdos","responsable":"Colectivo","duracion_min":30}]'::jsonb)
        returning id into v_ses;
        insert into cte_agreements (tenant_id, session_id, description, responsible_profile_id, responsible_label, due_date, status, follow_up, created_by) values
            (v, v_ses, 'Reforzar fracciones en primer grado con una sesión semanal', t[1], tn[1], current_date + 20, 'EN_PROCESO', 'Dos sesiones dadas.', v_dir),
            (v, v_ses, 'Entregar la lista de alumnos en riesgo por grupo', null, 'Asesores de grupo', current_date - 5, 'PENDIENTE', null, v_dir),
            (v, v_ses, 'Aplicar la encuesta socioemocional en todos los grupos', null, 'Colectivo docente', current_date - 8, 'CUMPLIDO', 'Capturada en el sistema.', v_dir);
        insert into support_requests (tenant_id, created_by, kind, title, details, status) values
            (v, t[1], 'PERSONAL', 'Corregir mi segundo apellido', 'Aparece mal escrito en la lista del personal.', 'PENDING'),
            (v, t[3], 'PERSONAL', 'No veo a un alumno nuevo en mi lista', 'Se integró esta semana a 2° B.', 'IN_PROGRESS');
        done := array_append(done, 'avisos, calendario y CTE');
    end if;

    return jsonb_build_object('success', true, 'agregado', to_jsonb(done),
        'alumnos_con_dificultades', (select jsonb_agg(concat(s.first_name, ' ', s.last_name_paternal, ' (', gg.grade, '° ', gg.section, ')') order by x.ord)
            from unnest(array[p1, p2, p3, p4, p5, p6]) with ordinality x(id, ord) join students s on s.id = x.id join groups gg on gg.id = s.group_id),
        'docentes_con_dificultades', jsonb_build_array(tn[2], tn[3]));
end $fn$;
revoke all on function public.demo_escenarios() from public, anon, authenticated;
