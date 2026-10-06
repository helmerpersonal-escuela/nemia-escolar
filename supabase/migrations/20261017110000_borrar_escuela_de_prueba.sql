-- Limpieza de la escuela de prueba. Borra SOLO lo que creó demo_seed (lo anotado en demo_runs):
-- la escuela ficticia, todo lo que cuelga de ella y las cuentas de demostración.
-- No toca a ninguna escuela real ni a ninguna cuenta real, aunque se ejecute en producción.
-- Es una sola operación: si algo falla, no se borra nada (no quedan datos a medias).

create or replace function public.demo_purge()
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
    run record;
    t record;
    pass int;
    pending int;
    n bigint;
    removed jsonb := '{}'::jsonb;
    users_removed bigint := 0;
    leftover bigint := 0;
    runs int := 0;
begin
    if coalesce(auth.role(), '') <> 'service_role' and session_user not in ('postgres', 'supabase_admin') then
        raise exception 'Solo el servidor puede borrar la escuela de prueba';
    end if;

    for run in select * from demo_runs order by created_at loop
        runs := runs + 1;
        -- Candados: lo anotado tiene que ser de verdad la escuela ficticia y sus cuentas de demostración
        if exists (select 1 from tenants where id = run.tenant_id and cct is distinct from '07DST9990Z') then
            raise exception 'El espacio anotado no es la escuela de prueba. No se borró nada.';
        end if;
        if exists (select 1 from auth.users where id = any(run.user_ids) and email not like 'demo.%@demo.vunlek.test') then
            raise exception 'Alguna cuenta anotada no es de demostración. No se borró nada.';
        end if;

        -- Las cuentas sueltan primero a la escuela (si no, sus perfiles impedirían borrarla)
        update profiles set tenant_id = null, last_tenant_id = null, advisory_group_id = null where id = any(run.user_ids);

        -- Todo lo que pertenece a la escuela. Se repite hasta que no queden dependencias entre tablas.
        for pass in 1..10 loop
            pending := 0;
            for t in
                select c.table_name
                from information_schema.columns c
                join information_schema.tables b on b.table_schema = c.table_schema and b.table_name = c.table_name
                where c.table_schema = 'public' and c.column_name = 'tenant_id' and b.table_type = 'BASE TABLE'
                  and c.table_name not in ('profiles', 'demo_runs')
            loop
                begin
                    execute format('delete from public.%I where tenant_id = $1', t.table_name) using run.tenant_id;
                    get diagnostics n = row_count;
                    if n > 0 then
                        removed := removed || jsonb_build_object(t.table_name, coalesce((removed->>t.table_name)::bigint, 0) + n);
                    end if;
                exception when foreign_key_violation then
                    pending := pending + 1;   -- otra tabla todavía la usa: se reintenta en la siguiente vuelta
                end;
            end loop;
            exit when pending = 0;
        end loop;
        if pending > 0 then
            raise exception 'No se pudo borrar todo: % tablas siguen con referencias. No se borró nada.', pending;
        end if;

        -- Las cuentas de demostración (sus perfiles y puestos se van con ellas)
        delete from auth.users where id = any(run.user_ids);
        get diagnostics n = row_count;
        users_removed := users_removed + n;
        delete from profiles where id = any(run.user_ids);

        delete from tenants where id = run.tenant_id;

        -- La bitácora de cambios de esos registros (incluida la que generó este mismo borrado)
        delete from audit_logs
        where record_id = run.tenant_id or record_id = any(run.user_ids)
           or new_data->>'tenant_id' = run.tenant_id::text or old_data->>'tenant_id' = run.tenant_id::text;

        -- Comprobación: no debe quedar ninguna fila de esa escuela en ninguna tabla
        for t in
            select c.table_name from information_schema.columns c
            join information_schema.tables b on b.table_schema = c.table_schema and b.table_name = c.table_name
            where c.table_schema = 'public' and c.column_name = 'tenant_id' and b.table_type = 'BASE TABLE' and c.table_name <> 'demo_runs'
        loop
            execute format('select count(*) from public.%I where tenant_id = $1', t.table_name) into n using run.tenant_id;
            leftover := leftover + n;
        end loop;
        if leftover > 0 or exists (select 1 from guardians where user_id = any(run.user_ids) or profile_id = any(run.user_ids)) then
            raise exception 'Quedaron registros sin borrar. No se borró nada.';
        end if;

        delete from demo_runs where id = run.id;
    end loop;

    return jsonb_build_object('success', true, 'schools', runs, 'users', users_removed, 'rows', removed, 'leftover', leftover);
end $$;

revoke all on function public.demo_purge() from public, anon, authenticated;
grant execute on function public.demo_purge() to service_role;
