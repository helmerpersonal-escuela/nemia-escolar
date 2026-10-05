-- Quitar uno de los puestos de una persona y ceder la dirección cuando ya se tiene el puesto de técnico.
-- (Separado porque contiene borrados: requiere confirmación al aplicarlo.)

-- Quitar solo uno de los puestos (si es el único, se da de baja de la escuela)
create or replace function public.remove_staff_role(p_profile_id uuid, p_role text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_tenant uuid := private.assert_school_admin(); v_role text := upper(p_role); v_next text;
begin
    if (select count(*) from profile_tenants where profile_id = p_profile_id and tenant_id = v_tenant) <= 1 then
        perform public.remove_staff_member(p_profile_id);
        return;
    end if;
    if not public.is_god_mode() and v_role in ('DIRECTOR', 'ADMIN', 'SYSTEM_ADMIN')
       and not exists (select 1 from profile_tenants where profile_id = auth.uid() and tenant_id = v_tenant and upper(role) in ('DIRECTOR', 'ADMIN')) then
        raise exception 'Solo la dirección puede quitar ese puesto' using errcode = '42501';
    end if;
    if p_profile_id = auth.uid() and v_role in ('DIRECTOR', 'ADMIN')
       and not exists (select 1 from profile_tenants where tenant_id = v_tenant and profile_id <> auth.uid() and upper(role) in ('DIRECTOR', 'ADMIN')) then
        raise exception 'La escuela no puede quedarse sin dirección';
    end if;
    delete from profile_tenants where profile_id = p_profile_id and tenant_id = v_tenant and upper(role) = v_role;
    select role into v_next from profile_tenants where profile_id = p_profile_id and tenant_id = v_tenant limit 1;
    update profiles set role = v_next where id = p_profile_id and tenant_id = v_tenant and upper(role) = v_role;
    if v_role = 'TEACHER' then
        update group_subjects set teacher_id = null where teacher_id = p_profile_id and tenant_id = v_tenant;
    end if;
end $$;
revoke all on function public.remove_staff_role(uuid, text) from public, anon;
grant execute on function public.remove_staff_role(uuid, text) to authenticated;

create or replace function public.hand_over_direction()
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_tenant uuid := public.get_current_tenant_id();
begin
    if auth.uid() is null or v_tenant is null then raise exception 'Sesión requerida' using errcode = '42501'; end if;
    if not exists (select 1 from profile_tenants where profile_id = auth.uid() and tenant_id = v_tenant and upper(role) in ('DIRECTOR', 'ADMIN')) then
        raise exception 'Solo quien tiene el puesto de dirección puede cederlo';
    end if;
    if not exists (select 1 from profile_tenants where tenant_id = v_tenant and profile_id <> auth.uid() and upper(role) = 'DIRECTOR') then
        raise exception 'Primero invita al director o directora y espera a que acepte su invitación';
    end if;
    if exists (select 1 from profile_tenants where profile_id = auth.uid() and tenant_id = v_tenant and upper(role) = 'SYSTEM_ADMIN') then
        delete from profile_tenants where profile_id = auth.uid() and tenant_id = v_tenant and upper(role) in ('DIRECTOR', 'ADMIN');
    else
        update profile_tenants set role = 'SYSTEM_ADMIN', job_title = coalesce(job_title, 'Administrador técnico')
         where profile_id = auth.uid() and tenant_id = v_tenant and upper(role) in ('DIRECTOR', 'ADMIN');
    end if;
    update profiles set role = 'SYSTEM_ADMIN' where id = auth.uid() and tenant_id = v_tenant;
end $$;

