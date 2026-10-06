-- Horario de clases para la escuela de prueba: 7 módulos de 50 minutos de lunes a viernes,
-- sin que un docente quede en dos grupos a la misma hora. Solo actúa sobre la escuela de prueba
-- y solo si todavía no tiene horario.
create or replace function public.demo_horario()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
    v_tenant uuid; d text; i int; g record; pick record; n int := 0;
    starts time[] := array['07:00', '07:50', '08:40', '09:50', '10:40', '11:30', '12:20']::time[];
begin
    if coalesce(auth.role(), '') <> 'service_role' and session_user not in ('postgres', 'supabase_admin') then
        raise exception 'Solo el servidor puede completar la escuela de prueba';
    end if;
    select tenant_id into v_tenant from demo_runs order by created_at desc limit 1;
    if v_tenant is null or not exists (select 1 from tenants where id = v_tenant and cct = '07DST9990Z') then
        return jsonb_build_object('success', false, 'error', 'No hay escuela de prueba');
    end if;
    if exists (select 1 from schedules where tenant_id = v_tenant) then
        return jsonb_build_object('success', true, 'clases', 0, 'nota', 'Ya tenía horario');
    end if;

    foreach d in array array['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] loop
        for i in 1..7 loop
            for g in select id from groups where tenant_id = v_tenant and archived_at is null order by grade, section loop
                select gs.subject_catalog_id into pick
                from group_subjects gs
                where gs.tenant_id = v_tenant and gs.group_id = g.id and gs.subject_catalog_id is not null
                  and not exists (
                      select 1 from schedules s
                      join group_subjects g2 on g2.group_id = s.group_id and g2.subject_catalog_id = s.subject_id
                      where s.tenant_id = v_tenant and s.day_of_week = d and s.start_time = starts[i]
                        and g2.teacher_id is not distinct from gs.teacher_id)
                order by (select count(*) from schedules s where s.group_id = g.id and s.subject_id = gs.subject_catalog_id and s.day_of_week = d),
                         (select count(*) from schedules s where s.group_id = g.id and s.subject_id = gs.subject_catalog_id),
                         gs.id
                limit 1;
                if found then
                    insert into schedules (tenant_id, group_id, subject_id, day_of_week, start_time, end_time)
                    values (v_tenant, g.id, pick.subject_catalog_id, d, starts[i], starts[i] + interval '50 minutes');
                    n := n + 1;
                end if;
            end loop;
        end loop;
    end loop;
    return jsonb_build_object('success', true, 'clases', n);
end $function$;

revoke all on function public.demo_horario() from public, anon, authenticated;
