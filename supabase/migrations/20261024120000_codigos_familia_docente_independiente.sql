-- Códigos para familias también en el espacio de un docente independiente.
-- El docente independiente es el dueño de su espacio (tenant de tipo INDEPENDENT): puede generar
-- los códigos de sus alumnos y autorizar o retirar las cuentas adicionales de las familias.
-- En espacios de escuela no cambia nada.
create or replace function private.assert_family_code_manager(p_tenant uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
    if auth.uid() is null then raise exception 'Sesión requerida' using errcode = '42501'; end if;
    if public.is_god_mode() then return; end if;
    if exists (select 1 from public.profile_tenants pt
               where pt.profile_id = auth.uid() and pt.tenant_id = p_tenant
                 and upper(pt.role) in ('DIRECTOR', 'ADMIN', 'SCHOOL_CONTROL', 'ACADEMIC_COORD', 'TECH_COORD', 'SYSTEM_ADMIN')) then
        return;
    end if;
    if exists (select 1 from public.profile_tenants pt join public.tenants t on t.id = pt.tenant_id
               where pt.profile_id = auth.uid() and pt.tenant_id = p_tenant
                 and upper(pt.role) = 'INDEPENDENT_TEACHER' and t.type = 'INDEPENDENT') then
        return;
    end if;
    raise exception 'Solo dirección, coordinación, control escolar, el administrador técnico o el docente dueño de su espacio pueden generar los códigos para familias' using errcode = '42501';
end
$$;

create or replace function private.family_manager(p_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select public.is_god_mode()
        or exists (select 1 from profile_tenants where profile_id = auth.uid() and tenant_id = p_tenant
                     and upper(role) in ('DIRECTOR', 'ADMIN', 'SCHOOL_CONTROL', 'SYSTEM_ADMIN', 'ACADEMIC_COORD'))
        or exists (select 1 from profile_tenants pt join tenants t on t.id = pt.tenant_id
                    where pt.profile_id = auth.uid() and pt.tenant_id = p_tenant
                      and upper(pt.role) = 'INDEPENDENT_TEACHER' and t.type = 'INDEPENDENT');
$$;
