-- Personal de la escuela: lista real (por membresía, no por espacio activo), dar de baja y cambiar rol.

create or replace function public.school_staff()
returns table(profile_id uuid, first_name text, last_name_paternal text, last_name_maternal text,
              avatar_url text, email text, role text, is_me boolean)
language sql
stable
security definer
set search_path to 'public'
as $$
    select pt.profile_id,
           coalesce(pt.first_name, p.first_name)::text,
           coalesce(pt.last_name_paternal, p.last_name_paternal)::text,
           coalesce(pt.last_name_maternal, p.last_name_maternal)::text,
           coalesce(pt.avatar_url, p.avatar_url)::text,
           u.email::text,
           upper(pt.role)::text,
           pt.profile_id = auth.uid()
      from profile_tenants pt
      join profiles p on p.id = pt.profile_id
      left join auth.users u on u.id = pt.profile_id
     where pt.tenant_id = public.get_current_tenant_id()
       and p.deleted_at is null
       and upper(pt.role) not in ('STUDENT', 'TUTOR')
       and exists (select 1 from profile_tenants me where me.profile_id = auth.uid() and me.tenant_id = pt.tenant_id)
     order by 2, 3;
$$;
grant execute on function public.school_staff() to authenticated;

create or replace function private.assert_school_admin()
returns uuid
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare v_tenant uuid := public.get_current_tenant_id();
begin
    if auth.uid() is null or v_tenant is null then
        raise exception 'Sesión requerida' using errcode = '42501';
    end if;
    if not exists (select 1 from profile_tenants where profile_id = auth.uid() and tenant_id = v_tenant
                   and upper(role) in ('DIRECTOR', 'ADMIN', 'SUPER_ADMIN')) and not public.is_god_mode() then
        raise exception 'Solo la dirección puede dar de alta o de baja al personal' using errcode = '42501';
    end if;
    return v_tenant;
end;
$$;

create or replace function public.remove_staff_member(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
    v_tenant uuid := private.assert_school_admin();
    v_next uuid;
    v_next_role text;
begin
    if p_profile_id = auth.uid() then
        raise exception 'No puedes darte de baja a ti mismo desde aquí';
    end if;
    delete from profile_tenants where profile_id = p_profile_id and tenant_id = v_tenant;
    -- Si esa escuela era su espacio activo, lo pasa a otro espacio suyo (o a ninguno)
    if exists (select 1 from profiles where id = p_profile_id and tenant_id = v_tenant) then
        select tenant_id, role into v_next, v_next_role from profile_tenants
         where profile_id = p_profile_id order by is_default desc nulls last limit 1;
        update profiles set tenant_id = v_next, role = coalesce(v_next_role, role) where id = p_profile_id;
    end if;
    -- Deja de ser responsable de grupos/materias en esa escuela
    update group_subjects set teacher_id = null where teacher_id = p_profile_id and tenant_id = v_tenant;
end;
$$;
grant execute on function public.remove_staff_member(uuid) to authenticated;

create or replace function public.set_staff_role(p_profile_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_tenant uuid := private.assert_school_admin(); v_role text := upper(p_role);
begin
    if v_role not in ('DIRECTOR', 'ADMIN', 'ACADEMIC_COORD', 'TECH_COORD', 'SCHOOL_CONTROL', 'TEACHER', 'PREFECT', 'SUPPORT') then
        raise exception 'Rol no permitido';
    end if;
    if p_profile_id = auth.uid() then
        raise exception 'No puedes cambiar tu propio rol desde aquí';
    end if;
    update profile_tenants set role = v_role where profile_id = p_profile_id and tenant_id = v_tenant;
    update profiles set role = v_role where id = p_profile_id and tenant_id = v_tenant;
end;
$$;
grant execute on function public.set_staff_role(uuid, text) to authenticated;
