-- Modo dios: consulta de personas y espacios, vista previa de borrado y restauración completa.
-- (El borrado definitivo vive en 20261016110000_modo_dios_borrar_persona.sql)

create or replace function public.admin_people()
returns jsonb language plpgsql stable security definer set search_path to 'public'
as $$
begin
    if not public.is_god_mode() then raise exception 'No autorizado'; end if;
    return coalesce((
        select jsonb_agg(jsonb_build_object(
            'id', p.id,
            'email', coalesce(u.raw_user_meta_data->>'deleted_original_email', p.email, u.email),
            'first_name', p.first_name, 'last_name_paternal', p.last_name_paternal, 'last_name_maternal', p.last_name_maternal,
            'role', p.role, 'tenant_id', p.tenant_id,
            'created_at', coalesce(u.created_at, p.created_at), 'deleted_at', p.deleted_at,
            'email_confirmed', u.email_confirmed_at is not null,
            'last_sign_in_at', u.last_sign_in_at,
            'is_god', lower(coalesce(u.email, '')) in ('helmerferras@gmail.com', 'helmerpersonal@gmail.com') or p.role = 'SUPER_ADMIN',
            'spaces', coalesce((
                select jsonb_agg(jsonb_build_object('tenant_id', t.id, 'name', t.name, 'type', t.type, 'role', pt.role) order by t.name)
                from profile_tenants pt join tenants t on t.id = pt.tenant_id where pt.profile_id = p.id), '[]'::jsonb),
            'home_space', (select t.name from tenants t where t.id = p.tenant_id)
        ) order by p.deleted_at nulls first, coalesce(u.created_at, p.created_at) desc)
        from profiles p left join auth.users u on u.id = p.id), '[]'::jsonb);
end $$;

create or replace function public.admin_spaces()
returns jsonb language plpgsql stable security definer set search_path to 'public'
as $$
begin
    if not public.is_god_mode() then raise exception 'No autorizado'; end if;
    return coalesce((
        select jsonb_agg(jsonb_build_object(
            'id', t.id, 'name', t.name, 'type', t.type, 'cct', t.cct, 'created_at', t.created_at,
            'members', (select count(*) from profile_tenants pt where pt.tenant_id = t.id),
            'students', (select count(*) from students s where s.tenant_id = t.id),
            'groups', (select count(*) from groups g where g.tenant_id = t.id),
            'sub_status', s.status, 'sub_plan', s.plan,
            'sub_ends', case when s.status = 'TRIAL' then s.trial_ends_at else s.current_period_end end
        ) order by t.created_at desc)
        from tenants t left join space_subscriptions s on s.tenant_id = t.id), '[]'::jsonb);
end $$;

-- Qué se vería afectado al borrar definitivamente a una persona (no cambia nada).
create or replace function public.admin_user_footprint(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public'
as $$
declare
    r record;
    n bigint;
    refs jsonb := '[]'::jsonb;
    v_email text;
    v_current text;
    v_blocked text;
begin
    if not public.is_god_mode() then raise exception 'No autorizado'; end if;
    select u.email, coalesce(u.raw_user_meta_data->>'deleted_original_email', u.email) into v_current, v_email from auth.users u where u.id = p_user;
    if p_user = auth.uid() then v_blocked := 'No puedes borrar tu propia cuenta desde aquí.';
    elsif lower(coalesce(v_current, '')) in ('helmerferras@gmail.com', 'helmerpersonal@gmail.com') then v_blocked := 'Esta es una cuenta de super administrador.';
    end if;

    for r in
        select c.conrelid::regclass::text as tbl, a.attname::text as col, c.confdeltype::text as del, a.attnotnull as nn
        from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
        where c.contype = 'f' and array_length(c.conkey, 1) = 1
          and c.confrelid in ('public.profiles'::regclass, 'auth.users'::regclass)
          and c.connamespace = 'public'::regnamespace and c.conrelid <> 'public.profiles'::regclass
    loop
        execute format('select count(*) from %s where %I = $1', r.tbl, r.col) into n using p_user;
        if n > 0 then
            refs := refs || jsonb_build_object('table', r.tbl, 'column', r.col, 'rows', n,
                'effect', case when r.del = 'c' or (r.del in ('a', 'r') and r.nn) then 'DELETE' else 'KEEP' end);
        end if;
    end loop;

    return jsonb_build_object(
        'email', v_email, 'blocked', v_blocked,
        'spaces', coalesce((
            select jsonb_agg(jsonb_build_object('tenant_id', t.id, 'name', t.name, 'type', t.type, 'role', x.role,
                'other_members', (select count(*) from profile_tenants o where o.tenant_id = t.id and o.profile_id <> p_user),
                'students', (select count(*) from students s where s.tenant_id = t.id)))
            from (select pt.tenant_id, pt.role from profile_tenants pt where pt.profile_id = p_user
                  union select p.tenant_id, p.role from profiles p where p.id = p_user and p.tenant_id is not null
                        and not exists (select 1 from profile_tenants pt where pt.profile_id = p_user and pt.tenant_id = p.tenant_id)) x
            join tenants t on t.id = x.tenant_id), '[]'::jsonb),
        'references', refs);
end $$;

-- Restaurar una cuenta dada de baja: correo, acceso y su lugar en el espacio.
create or replace function public.admin_restore_account(p_user uuid)
returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare
    v_original text;
    p record;
begin
    if not public.is_god_mode() then raise exception 'No autorizado'; end if;
    select raw_user_meta_data->>'deleted_original_email' into v_original from auth.users where id = p_user;
    if not found then raise exception 'La cuenta ya no existe'; end if;
    if v_original is not null then
        if exists (select 1 from auth.users where lower(email) = lower(v_original) and id <> p_user) then
            raise exception 'El correo % ya lo usa otra cuenta; no se puede restaurar', v_original;
        end if;
        update auth.users set email = v_original, raw_user_meta_data = raw_user_meta_data - 'deleted_original_email' where id = p_user;
    end if;
    update auth.users set banned_until = null where id = p_user;
    update profiles set deleted_at = null, email = coalesce(v_original, email) where id = p_user returning * into p;
    if p.tenant_id is not null and exists (select 1 from tenants where id = p.tenant_id)
       and not exists (select 1 from profile_tenants where profile_id = p_user and tenant_id = p.tenant_id) then
        insert into profile_tenants (profile_id, tenant_id, role, is_default) values (p_user, p.tenant_id, p.role, true);
    end if;
    return jsonb_build_object('success', true, 'email', coalesce(v_original, p.email));
end $$;

revoke all on function public.admin_people() from public, anon;
revoke all on function public.admin_spaces() from public, anon;
revoke all on function public.admin_user_footprint(uuid) from public, anon;
revoke all on function public.admin_restore_account(uuid) from public, anon;
grant execute on function public.admin_people(), public.admin_spaces(), public.admin_user_footprint(uuid), public.admin_restore_account(uuid) to authenticated;
