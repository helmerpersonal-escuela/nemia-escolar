-- Escuela de prueba: un programa analítico por docente y campo formativo, solo con SUS materias.
-- Antes cada campo tenía un solo programa con todas las disciplinas del campo, y el paso 7
-- ("Revisión final") marcaba en rojo los contenidos de materias ajenas al docente.
-- Se llama desde tools/demo/crear-escuela-demo.mjs después de demo_seed y es idempotente.
create or replace function public.demo_programas_por_docente()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    v_tenant uuid;
    prog record;
    t record;
    v_key text;
    v_items jsonb;
    v_new uuid;
    n int := 0;
begin
    select tenant_id into v_tenant from demo_runs order by created_at desc limit 1;
    if v_tenant is null then return 0; end if;

    for prog in select * from analytical_programs where tenant_id = v_tenant and based_on_id is null order by created_at loop
        v_key := case prog.field_of_study
                     when 'Lenguajes' then 'lenguajes'
                     when 'Saberes y Pensamiento Científico' then 'saberes'
                     when 'Ética, Naturaleza y Sociedades' then 'etica'
                     else 'humano' end;
        for t in
            select gs.teacher_id, array_agg(distinct initcap(sc.name)) as names, array_agg(distinct gs.subject_catalog_id) as sids
            from group_subjects gs join subject_catalog sc on sc.id = gs.subject_catalog_id
            where gs.tenant_id = v_tenant and sc.field_of_study = prog.field_of_study and gs.teacher_id is not null
            group by gs.teacher_id
        loop
            select coalesce(jsonb_agg(it), '[]'::jsonb) into v_items
            from jsonb_array_elements(coalesce(prog.program_by_fields -> v_key, '[]'::jsonb)) it
            where it ->> 'subject_name' = any (t.names);

            if t.teacher_id = prog.created_by then
                update analytical_programs
                   set program_by_fields = jsonb_set(program_by_fields, array[v_key], v_items), updated_at = now()
                 where id = prog.id;
                delete from analytical_program_contents where program_id = prog.id and not (subject_id = any (t.sids));
                n := n + 1;
            elsif not exists (select 1 from analytical_programs
                              where tenant_id = v_tenant and field_of_study = prog.field_of_study and created_by = t.teacher_id) then
                insert into analytical_programs (tenant_id, academic_year_id, field_of_study, status, created_by, diagnosis_context,
                                                 school_data, group_diagnosis, problem_statements, program_by_fields)
                values (v_tenant, prog.academic_year_id, prog.field_of_study, prog.status, t.teacher_id, prog.diagnosis_context,
                        prog.school_data, prog.group_diagnosis, prog.problem_statements,
                        jsonb_set(prog.program_by_fields, array[v_key], v_items))
                returning id into v_new;
                insert into analytical_program_contents (program_id, campo_formativo, subject_id, custom_content, justification, temporality, ejes_articuladores)
                select v_new, c.campo_formativo, c.subject_id, c.custom_content, c.justification, c.temporality, c.ejes_articuladores
                from analytical_program_contents c where c.program_id = prog.id and c.subject_id = any (t.sids);
                n := n + 1;
            end if;
        end loop;
    end loop;
    return n;
end
$$;

revoke all on function public.demo_programas_por_docente() from public, anon, authenticated;
grant execute on function public.demo_programas_por_docente() to service_role;
