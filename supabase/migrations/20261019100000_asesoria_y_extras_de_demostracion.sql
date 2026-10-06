-- 1) La dirección asigna el grupo de asesoría de un docente (antes fallaba en silencio:
--    nadie puede editar el perfil de otra persona directamente).
create or replace function public.set_advisory_group(p_profile uuid, p_group uuid)
returns void
language plpgsql security definer set search_path to 'public'
as $$
declare
    v_tenant uuid := public.get_current_tenant_id();
begin
    if not public.is_import_manager(v_tenant) then
        raise exception 'Solo la dirección o coordinación puede asignar asesorías' using errcode = '42501';
    end if;
    if not exists (select 1 from profile_tenants where profile_id = p_profile and tenant_id = v_tenant) then
        raise exception 'Esa persona no pertenece a esta escuela';
    end if;
    if p_group is not null and not exists (select 1 from groups where id = p_group and tenant_id = v_tenant) then
        raise exception 'Ese grupo no pertenece a esta escuela';
    end if;
    update profiles set advisory_group_id = p_group where id = p_profile;
end $$;
revoke all on function public.set_advisory_group(uuid, uuid) from public, anon;
grant execute on function public.set_advisory_group(uuid, uuid) to authenticated;

-- 2) Escuela de prueba: comisiones, asistencia, incidencias y citatorios ficticios,
--    para que los reportes de dirección tengan qué mostrar. Solo toca la escuela anotada en demo_runs.
create or replace function public.demo_extras()
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
    v_tenant uuid; v_year text; v_director uuid;
    t uuid[]; tn text[];
    names text[] := array['Técnico-pedagógica', 'Deporte', 'Higiene y salud', 'Jardinería', 'Protección civil', 'Sociocultural'];
    i int; n_att bigint := 0; n_inc bigint := 0; n_com bigint := 0;
    s record;
begin
    if coalesce(auth.role(), '') <> 'service_role' and session_user not in ('postgres', 'supabase_admin') then
        raise exception 'Solo el servidor puede completar la escuela de prueba';
    end if;
    select tenant_id into v_tenant from demo_runs order by created_at desc limit 1;
    if v_tenant is null or not exists (select 1 from tenants where id = v_tenant and cct = '07DST9990Z') then
        return jsonb_build_object('success', false, 'error', 'No hay escuela de prueba');
    end if;
    select name into v_year from academic_years where tenant_id = v_tenant and is_active limit 1;
    select profile_id into v_director from profile_tenants where tenant_id = v_tenant and role = 'DIRECTOR' limit 1;
    select array_agg(x.profile_id order by x.nm), array_agg(x.nm order by x.nm) into t, tn
    from (select pt.profile_id, concat_ws(' ', pt.first_name, pt.last_name_paternal, pt.last_name_maternal) nm
          from profile_tenants pt where pt.tenant_id = v_tenant and pt.role = 'TEACHER') x;

    -- Comisiones: cada docente queda en al menos una; unas con presidencia y vocales, otras con responsable
    if not exists (select 1 from school_commissions where tenant_id = v_tenant) and coalesce(array_length(t, 1), 0) >= 6 then
        for i in 1..6 loop
            insert into school_commissions (tenant_id, school_year, name, source, members)
            values (v_tenant, coalesce(v_year, '2026-2027'), names[i], 'Demostración',
                case when i <= 3 then jsonb_build_array(
                        jsonb_build_object('profile_id', t[i], 'name', tn[i], 'role', 'Presidente/a'),
                        jsonb_build_object('profile_id', t[((i + 2) % array_length(t, 1)) + 1], 'name', tn[((i + 2) % array_length(t, 1)) + 1], 'role', 'Vicepresidente/a'),
                        jsonb_build_object('profile_id', t[((i + 5) % array_length(t, 1)) + 1], 'name', tn[((i + 5) % array_length(t, 1)) + 1], 'role', 'Vocal'),
                        jsonb_build_object('profile_id', t[((i + 7) % array_length(t, 1)) + 1], 'name', tn[((i + 7) % array_length(t, 1)) + 1], 'role', 'Vocal'))
                     else jsonb_build_array(
                        jsonb_build_object('profile_id', t[i], 'name', tn[i], 'role', 'Responsable'),
                        jsonb_build_object('profile_id', t[((i + 3) % array_length(t, 1)) + 1], 'name', tn[((i + 3) % array_length(t, 1)) + 1], 'role', 'Integrante'))
                end);
            n_com := n_com + 1;
        end loop;
    end if;

    -- Asistencia de los últimos 15 días hábiles
    if not exists (select 1 from attendance where tenant_id = v_tenant) then
        perform setseed(0.42);
        insert into attendance (tenant_id, group_id, student_id, date, status)
        select v_tenant, st.group_id, st.id, d::date,
               case when r < 0.90 then 'PRESENT' when r < 0.94 then 'LATE' when r < 0.99 then 'ABSENT' else 'EXCUSED' end
        from students st
        cross join generate_series(current_date - 21, current_date - 1, interval '1 day') d
        cross join lateral (select random() r) x
        where st.tenant_id = v_tenant and st.group_id is not null and extract(isodow from d) < 6
        on conflict do nothing;
        get diagnostics n_att = row_count;
    end if;

    -- Incidencias y dos citatorios
    if not exists (select 1 from student_incidents where tenant_id = v_tenant) and coalesce(array_length(t, 1), 0) >= 3 then
        i := 0;
        for s in select id from students where tenant_id = v_tenant order by id limit 8 loop
            i := i + 1;
            insert into student_incidents (tenant_id, student_id, teacher_id, type, severity, title, description, action_taken, status, created_at)
            values (v_tenant, s.id, t[1 + (i % array_length(t, 1))],
                (array['CONDUCTA', 'ACADEMICO', 'POSITIVO', 'CONDUCTA', 'EMOCIONAL', 'ACADEMICO', 'POSITIVO', 'CONDUCTA'])[i],
                (array['MEDIA', 'BAJA', 'BAJA', 'ALTA', 'MEDIA', 'MEDIA', 'BAJA', 'BAJA'])[i],
                (array['Uso del celular en clase', 'No entregó el proyecto', 'Apoyó a sus compañeros', 'Discusión con un compañero', 'Se le nota desanimado', 'Bajo desempeño en el examen', 'Participación destacada', 'Llegó tarde al salón'])[i],
                (array['Usó el celular durante la explicación a pesar de dos avisos.', 'No presentó el producto del proyecto integrador.', 'Explicó el tema a su equipo y los ayudó a terminar.', 'Discutió en el receso; se separó a ambos y se habló con ellos.', 'Ha estado callado y sin ganas de trabajar esta semana.', 'Obtuvo una calificación baja; se acordó asesoría.', 'Expuso su trabajo con claridad ante el grupo.', 'Entró diez minutos tarde después del receso.'])[i],
                case when i % 2 = 0 then 'Se habló con el alumno y se dio aviso a su tutor.' end,
                case when i % 3 = 0 then 'RESOLVED' else 'OPEN' end, now() - make_interval(days => i * 2));
            n_inc := n_inc + 1;
            if i in (1, 4) then
                insert into student_citations (tenant_id, student_id, reason, meeting_date, meeting_time, status, requested_by)
                values (v_tenant, s.id, 'Platicar sobre la conducta del alumno y acordar compromisos.', current_date + i, '08:00', 'PENDING', v_director);
            end if;
        end loop;
    end if;

    return jsonb_build_object('success', true, 'comisiones', n_com, 'asistencias', n_att, 'incidencias', n_inc);
end $$;
revoke all on function public.demo_extras() from public, anon, authenticated;
grant execute on function public.demo_extras() to service_role;
