-- Modo dios: borrar definitivamente a UNA persona (su cuenta y su perfil), sin tocar la escuela.
--
-- OJO: la función anterior purge_account borraba TODO el espacio de la persona (alumnos,
-- calificaciones, grupos y a los demás miembros). Esta solo borra a la persona:
--   · lo que otros registros guardan como "quién lo hizo" queda sin autor (no se pierde el registro)
--   · lo que es propio de la persona (sus mensajes, su agenda, sus puestos) se borra con ella
-- La escuela o el espacio, con sus alumnos y calificaciones, se queda como está.

create or replace function public.admin_delete_user(p_user uuid)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
    r record;
    v_current text;
    v_email text;
    v_has_auth boolean;
begin
    if not public.is_god_mode() then raise exception 'No autorizado'; end if;
    if p_user = auth.uid() then raise exception 'No puedes borrar tu propia cuenta desde aquí'; end if;

    select u.email, coalesce(u.raw_user_meta_data->>'deleted_original_email', u.email) into v_current, v_email
    from auth.users u where u.id = p_user;
    v_has_auth := found;
    if not v_has_auth and not exists (select 1 from profiles where id = p_user) then
        raise exception 'La cuenta ya no existe';
    end if;
    if lower(coalesce(v_current, '')) in ('helmerferras@gmail.com', 'helmerpersonal@gmail.com') then
        raise exception 'No se puede borrar una cuenta de super administrador';
    end if;

    -- Referencias que impedirían el borrado: se dejan sin autor o, si la columna es obligatoria,
    -- se borra ese registro (hoy solo aplica a la agenda personal del docente).
    for r in
        select c.conrelid::regclass::text as tbl, a.attname::text as col, a.attnotnull as nn
        from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
        where c.contype = 'f' and array_length(c.conkey, 1) = 1 and c.confdeltype in ('a', 'r')
          and c.confrelid in ('public.profiles'::regclass, 'auth.users'::regclass)
          and c.connamespace = 'public'::regnamespace and c.conrelid <> 'public.profiles'::regclass
    loop
        if r.nn then
            execute format('delete from %s where %I = $1', r.tbl, r.col) using p_user;
        else
            execute format('update %s set %I = null where %I = $1', r.tbl, r.col, r.col) using p_user;
        end if;
    end loop;

    delete from public.profile_tenants where profile_id = p_user;
    delete from public.profiles where id = p_user;
    if v_has_auth then
        delete from auth.users where id = p_user;
    end if;

    return jsonb_build_object('success', true, 'email', v_email);
end $$;

revoke all on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_delete_user(uuid) to authenticated;
