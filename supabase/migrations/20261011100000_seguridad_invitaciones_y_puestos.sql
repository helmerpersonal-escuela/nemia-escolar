-- 1) SEGURIDAD: las vistas de God Mode ya no tocan auth.users ni corren con permisos del dueño.
--    (Alerta de Supabase: auth_users_exposed / security_definer_view.)
create or replace view public.view_god_mode_subscriptions with (security_invoker = on) as
select s.id, s.user_id, s.status, s.plan_type, s.current_period_start, s.current_period_end, s.cancel_at_period_end,
       s.created_at, s.updated_at, s.mercadopago_subscription_id, s.mercadopago_customer_id, s.trial_start, s.trial_end,
       p.email::character varying(255) as user_email, p.first_name as user_first_name, p.last_name_paternal as user_last_name, p.avatar_url as user_avatar_url
  from public.subscriptions s left join public.profiles p on p.id = s.user_id where public.is_god_mode();
create or replace view public.view_god_mode_transactions with (security_invoker = on) as
select pt.id, pt.subscription_id, pt.tenant_id, pt.user_id, pt.amount, pt.currency, pt.status, pt.provider,
       pt.provider_payment_id, pt.created_at, pt.meta, p.email::character varying(255) as user_email, p.first_name as user_first_name
  from public.payment_transactions pt left join public.profiles p on p.id = pt.user_id where public.is_god_mode();

revoke all on public.view_god_mode_subscriptions, public.view_god_mode_transactions from public, anon, authenticated;
grant select on public.view_god_mode_subscriptions, public.view_god_mode_transactions to authenticated;

-- Funciones sin search_path fijo
do $$
declare r record;
begin
    for r in select p.oid::regprocedure as f from pg_proc p
              where p.pronamespace = 'public'::regnamespace and p.proname in ('coop_partner_folio', 'guardians_sync_account') loop
        execute format('alter function %s set search_path = public', r.f);
    end loop;
end $$;

-- 2) VARIOS PUESTOS POR PERSONA en la misma escuela (p. ej. secretario + administrador técnico).
--    profile_tenants ya admite una fila por (persona, escuela, puesto). El puesto "activo" es profiles.role
--    cuando profiles.tenant_id es esa escuela; la persona cambia entre sus puestos desde el menú.
create or replace function public.my_role_in_tenant(p_tenant uuid)
returns text language sql stable security definer set search_path to 'public' as $$
    select upper(pt.role)
      from public.profile_tenants pt
      left join public.profiles p on p.id = pt.profile_id
     where pt.profile_id = auth.uid() and pt.tenant_id = p_tenant
     order by (p.tenant_id = pt.tenant_id and upper(p.role) = upper(pt.role)) desc nulls last,
              array_position(array['DIRECTOR','ADMIN','SCHOOL_CONTROL','ACADEMIC_COORD','TECH_COORD','PREFECT','SUPPORT','TEACHER','INDEPENDENT_TEACHER','SYSTEM_ADMIN','TUTOR','STUDENT'], upper(pt.role)) nulls last
     limit 1;
$$;

create or replace function public.current_tenant_role()
returns text language sql stable security definer set search_path to 'public' as $$
    select coalesce(public.my_role_in_tenant(public.get_current_tenant_id()),
                    (select p.role from profiles p where p.id = auth.uid()))
$$;

create or replace function public.my_assignment()
returns table(role text, job_title text, assigned_grades smallint[], duties text)
language sql stable security definer set search_path to 'public' as $$
    select upper(pt.role)::text, pt.job_title, pt.assigned_grades, pt.duties
      from profile_tenants pt
     where pt.profile_id = auth.uid() and pt.tenant_id = public.get_current_tenant_id()
       and upper(pt.role) = public.my_role_in_tenant(pt.tenant_id)
     limit 1;
$$;

-- El bloqueo del técnico (sin datos pedagógicos) aplica solo si ese es su ÚNICO puesto en la escuela:
-- quien además es control escolar o docente ya tiene, por ese otro puesto, derecho a ver esos datos.
create or replace function public.tech_only_tenants()
returns uuid[] language sql stable security definer set search_path to 'public' as $$
    select coalesce(array_agg(t.tenant_id), '{}'::uuid[])
      from public.profile_tenants t
     where t.profile_id = auth.uid() and upper(t.role) = 'SYSTEM_ADMIN'
       and not exists (select 1 from public.profile_tenants o
                        where o.profile_id = t.profile_id and o.tenant_id = t.tenant_id
                          and upper(o.role) not in ('SYSTEM_ADMIN', 'TUTOR', 'STUDENT', 'GUEST', 'PENDING'));
$$;

create or replace function public.switch_workspace_role(new_tenant_id uuid, p_role text default null)
returns void language plpgsql security definer set search_path to 'public' as $$
declare target_role text;
begin
    if p_role is not null then
        select role into target_role from profile_tenants
         where profile_id = auth.uid() and tenant_id = new_tenant_id and upper(role) = upper(p_role);
    else
        select role into target_role from profile_tenants
         where profile_id = auth.uid() and tenant_id = new_tenant_id
         order by array_position(array['DIRECTOR','ADMIN','SCHOOL_CONTROL','ACADEMIC_COORD','TECH_COORD','PREFECT','SUPPORT','TEACHER','INDEPENDENT_TEACHER','SYSTEM_ADMIN','TUTOR','STUDENT'], upper(role)) nulls last
         limit 1;
    end if;
    if target_role is null then raise exception 'No tienes ese puesto en ese espacio'; end if;
    update public.profiles set tenant_id = new_tenant_id, role = target_role where id = auth.uid();
end $$;
revoke all on function public.switch_workspace_role(uuid, text) from public, anon;
grant execute on function public.switch_workspace_role(uuid, text) to authenticated;

create or replace function public.switch_workspace(new_tenant_id uuid)
returns void language sql security definer set search_path to 'public' as $$
    select public.switch_workspace_role(new_tenant_id, null);
$$;

create or replace function private.assert_can_manage_member(v_tenant uuid, p_profile_id uuid, p_new_role text default null)
returns void language plpgsql stable security definer set search_path to 'public' as $$
declare v_me text := public.my_role_in_tenant(v_tenant);
begin
    if public.is_god_mode() then return; end if;
    -- Solo quien tiene puesto de dirección decide sobre directivos y técnicos
    if exists (select 1 from profile_tenants where profile_id = auth.uid() and tenant_id = v_tenant and upper(role) in ('DIRECTOR', 'ADMIN')) then return; end if;
    if v_me is distinct from 'SYSTEM_ADMIN' then return; end if;
    if exists (select 1 from profile_tenants where profile_id = p_profile_id and tenant_id = v_tenant and upper(role) in ('DIRECTOR', 'ADMIN', 'SYSTEM_ADMIN')) then
        raise exception 'El administrador técnico no puede cambiar ni dar de baja a directivos ni a otros técnicos' using errcode = '42501';
    end if;
    if upper(coalesce(p_new_role, '')) in ('DIRECTOR', 'ADMIN', 'SYSTEM_ADMIN') then
        raise exception 'Solo la dirección puede asignar ese puesto' using errcode = '42501';
    end if;
end $$;

create or replace function public.change_staff_role(p_profile_id uuid, p_role text, p_old_role text default null)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_tenant uuid := private.assert_school_admin(); v_role text := upper(p_role); v_old text := upper(p_old_role); n int;
begin
    if v_role not in ('DIRECTOR', 'ADMIN', 'ACADEMIC_COORD', 'TECH_COORD', 'SCHOOL_CONTROL', 'TEACHER', 'PREFECT', 'SUPPORT', 'SYSTEM_ADMIN') then
        raise exception 'Rol no permitido';
    end if;
    if p_profile_id = auth.uid() then raise exception 'No puedes cambiar tu propio rol desde aquí'; end if;
    perform private.assert_can_manage_member(v_tenant, p_profile_id, v_role);
    select count(*) into n from profile_tenants where profile_id = p_profile_id and tenant_id = v_tenant;
    if n = 0 then raise exception 'Esa persona no pertenece a la escuela'; end if;
    if n > 1 and v_old is null then raise exception 'Esta persona tiene varios puestos: indica cuál quieres cambiar'; end if;
    if v_old is null then select upper(role) into v_old from profile_tenants where profile_id = p_profile_id and tenant_id = v_tenant; end if;
    if v_old = v_role then return; end if;
    if exists (select 1 from profile_tenants where profile_id = p_profile_id and tenant_id = v_tenant and upper(role) = v_role) then
        raise exception 'Esta persona ya tiene ese puesto';
    end if;
    update profile_tenants set role = v_role where profile_id = p_profile_id and tenant_id = v_tenant and upper(role) = v_old;
    update profiles set role = v_role where id = p_profile_id and tenant_id = v_tenant and upper(role) = v_old;
end $$;
revoke all on function public.change_staff_role(uuid, text, text) from public, anon;
grant execute on function public.change_staff_role(uuid, text, text) to authenticated;

create or replace function public.set_staff_role(p_profile_id uuid, p_role text)
returns void language sql security definer set search_path to 'public' as $$
    select public.change_staff_role(p_profile_id, p_role, null);
$$;

-- Agregar un segundo puesto a alguien que ya pertenece a la escuela
create or replace function public.add_staff_role(p_profile_id uuid, p_role text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_tenant uuid := private.assert_school_admin(); v_role text := upper(p_role); src record;
begin
    if v_role not in ('DIRECTOR', 'ADMIN', 'ACADEMIC_COORD', 'TECH_COORD', 'SCHOOL_CONTROL', 'TEACHER', 'PREFECT', 'SUPPORT', 'SYSTEM_ADMIN') then
        raise exception 'Rol no permitido';
    end if;
    if not public.is_god_mode() and upper(coalesce(p_role, '')) in ('DIRECTOR', 'ADMIN', 'SYSTEM_ADMIN')
       and not exists (select 1 from profile_tenants where profile_id = auth.uid() and tenant_id = v_tenant and upper(role) in ('DIRECTOR', 'ADMIN')) then
        raise exception 'Solo la dirección puede asignar ese puesto' using errcode = '42501';
    end if;
    select * into src from profile_tenants where profile_id = p_profile_id and tenant_id = v_tenant
       and upper(role) not in ('TUTOR', 'STUDENT') limit 1;
    if not found then raise exception 'Esa persona no pertenece al personal de la escuela'; end if;
    if exists (select 1 from profile_tenants where profile_id = p_profile_id and tenant_id = v_tenant and upper(role) = v_role) then
        raise exception 'Esta persona ya tiene ese puesto';
    end if;
    insert into profile_tenants (profile_id, tenant_id, role, is_default, first_name, last_name_paternal, last_name_maternal, avatar_url, job_title)
    values (p_profile_id, v_tenant, v_role, false, src.first_name, src.last_name_paternal, src.last_name_maternal, src.avatar_url,
            case when v_role = 'SYSTEM_ADMIN' then 'Administrador técnico' end);
end $$;
revoke all on function public.add_staff_role(uuid, text) from public, anon;
grant execute on function public.add_staff_role(uuid, text) to authenticated;

-- 3) INVITACIONES
-- 3a) Una cuenta nueva invitada como Administrador técnico no podía terminar su registro.
do $$
declare d text;
begin
    select pg_get_functiondef('public.complete_signup(text,text,text,text,text,uuid)'::regprocedure) into d;
    if d not like '%''STUDENT'', ''SYSTEM_ADMIN'')%' then
        d := replace(d, $q$'TEACHER', 'PREFECT', 'SUPPORT', 'TUTOR', 'STUDENT')$q$, $q$'TEACHER', 'PREFECT', 'SUPPORT', 'TUTOR', 'STUDENT', 'SYSTEM_ADMIN')$q$);
        execute d;
    end if;
end $$;

-- 3b) Si abren un enlace viejo (ya usado o vencido) y la escuela mandó una invitación nueva al mismo correo,
--     el enlace viejo lleva a la nueva. `still_member` dice si la persona sigue en la escuela.
create or replace function public.invitation_status(p_token uuid)
returns table(tenant_name text, role text, email text, status text, replacement_token uuid, still_member boolean)
language plpgsql stable security definer set search_path to 'public' as $$
begin
    return query
    select t.name::text, upper(i.role)::text, i.email::text,
           case when i.status <> 'PENDING' then upper(i.status)::text
                when i.expires_at <= now() then 'EXPIRED'
                else 'PENDING' end,
           (select n.token from staff_invitations n
             where n.tenant_id = i.tenant_id and lower(n.email) = lower(i.email) and n.id <> i.id
               and n.status = 'PENDING' and n.expires_at > now()
             order by n.created_at desc limit 1),
           exists (select 1 from profile_tenants pt join profiles p on p.id = pt.profile_id
                    where pt.tenant_id = i.tenant_id and lower(p.email) = lower(i.email) and upper(pt.role) = upper(i.role))
      from staff_invitations i
      join tenants t on t.id = i.tenant_id
     where i.token = p_token;
end $$;
revoke all on function public.invitation_status(uuid) from public;
grant execute on function public.invitation_status(uuid) to anon, authenticated;

-- 3c) Al invitar de nuevo al mismo correo y puesto, la invitación anterior sin aceptar se reemplaza (no se acumulan).
create or replace function private.invitation_replaces_previous()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
    new.email := lower(trim(new.email));
    update staff_invitations set status = 'EXPIRED'
     where tenant_id = new.tenant_id and lower(email) = new.email and upper(role) = upper(new.role) and status = 'PENDING';
    return new;
end $$;
create or replace trigger tr_invitation_replaces_previous before insert on public.staff_invitations
for each row execute function private.invitation_replaces_previous();

-- 3d) Reenviar: vuelve a dar 7 días a la invitación (si no se ha aceptado)
create or replace function public.refresh_invitation(p_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare inv record;
begin
    select * into inv from staff_invitations where id = p_id;
    if not found then raise exception 'La invitación no existe'; end if;
    if not (public.is_god_mode() or public.my_role_in_tenant(inv.tenant_id) in ('DIRECTOR', 'ADMIN', 'ACADEMIC_COORD', 'TECH_COORD', 'SYSTEM_ADMIN')) then
        raise exception 'Sin permiso' using errcode = '42501';
    end if;
    if inv.status = 'ACCEPTED' then raise exception 'Esa invitación ya se aceptó; envía una nueva'; end if;
    update staff_invitations set status = 'PENDING', expires_at = now() + interval '7 days' where id = p_id;
end $$;
revoke all on function public.refresh_invitation(uuid) from public, anon;
grant execute on function public.refresh_invitation(uuid) to authenticated;
