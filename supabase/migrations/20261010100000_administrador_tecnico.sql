-- Administrador técnico de la escuela (SYSTEM_ADMIN): opera el sistema (datos de la escuela, ciclo,
-- jornada, grupos, alumnos, tutores, horarios, personal, códigos e importación) pero NO ve
-- calificaciones, asistencia, conducta, BAP, antecedentes, planeaciones, CTE ni PEMC.
-- También: solicitudes de cambio al técnico y bitácora de lo que hace.

-- 1. El rol existe
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role = any (array[
    'ADMIN','TEACHER','TUTOR','STUDENT','INDEPENDENT_TEACHER','DIRECTOR','ACADEMIC_COORD','TECH_COORD',
    'SCHOOL_CONTROL','PREFECT','SUPPORT','SUPER_ADMIN','PENDING','SYSTEM_ADMIN']));
do $$ begin
    if exists (select 1 from pg_constraint where conname = 'profile_roles_check') then
        alter table public.profile_roles drop constraint profile_roles_check;
        alter table public.profile_roles add constraint profile_roles_check check (role = any (array[
            'SUPER_ADMIN','ADMIN','DIRECTOR','ACADEMIC_COORD','TECH_COORD','SCHOOL_CONTROL','TEACHER','PREFECT','SUPPORT',
            'TUTOR','STUDENT','INDEPENDENT_TEACHER','SOCIAL_WORKER','STAFF','GUEST','SYSTEM_ADMIN']));
    end if;
end $$;

-- Escuelas donde soy administrador técnico
create or replace function public.tech_only_tenants()
returns uuid[] language sql stable security definer set search_path = public as $$
    select coalesce(array_agg(tenant_id), '{}'::uuid[]) from public.profile_tenants
     where profile_id = auth.uid() and upper(role) = 'SYSTEM_ADMIN';
$$;
revoke execute on function public.tech_only_tenants() from anon;

-- 2. Lo que el técnico NO ve ni toca (políticas restrictivas: se suman a las demás)
do $$
declare t text;
begin
    foreach t in array array[
        'assignments','attendance','behavioral_contracts','class_plans','cte_agreements','cte_documents','cte_proposals',
        'cte_sessions','cte_teacher_tasks','cte_teacher_work','dropout_risk_cases','evaluation_snapshots','evidence_portfolio',
        'formative_records','grades','lesson_plans','pemc_cycles','rubrics','analytical_programs','teacher_formats',
        'student_alerts','student_bap_records','student_citations','student_history','student_incidents','student_tracking',
        'staff_attendance','staff_permits','teacher_absences','teacher_module_attendance','absence_plans','substitution_activities']
    loop
        if to_regclass('public.' || t) is not null then
            execute format('drop policy if exists tecnico_sin_acceso on public.%I', t);
            execute format('create policy tecnico_sin_acceso on public.%I as restrictive for all
                using (not coalesce(tenant_id = any ((select public.tech_only_tenants())::uuid[]), false))
                with check (not coalesce(tenant_id = any ((select public.tech_only_tenants())::uuid[]), false))', t);
        end if;
    end loop;
end $$;
drop policy if exists tecnico_sin_acceso on public.pemc_objectives;
create policy tecnico_sin_acceso on public.pemc_objectives as restrictive for all
    using (not coalesce(public.pemc_cycle_tenant(cycle_id) = any ((select public.tech_only_tenants())::uuid[]), false))
    with check (not coalesce(public.pemc_cycle_tenant(cycle_id) = any ((select public.tech_only_tenants())::uuid[]), false));
drop policy if exists tecnico_sin_acceso on public.pemc_diagnosis;
create policy tecnico_sin_acceso on public.pemc_diagnosis as restrictive for all
    using (not coalesce(public.pemc_cycle_tenant(cycle_id) = any ((select public.tech_only_tenants())::uuid[]), false))
    with check (not coalesce(public.pemc_cycle_tenant(cycle_id) = any ((select public.tech_only_tenants())::uuid[]), false));
drop policy if exists tecnico_sin_acceso on public.pemc_actions;
create policy tecnico_sin_acceso on public.pemc_actions as restrictive for all
    using (not coalesce(public.pemc_objective_tenant(objective_id) = any ((select public.tech_only_tenants())::uuid[]), false))
    with check (not coalesce(public.pemc_objective_tenant(objective_id) = any ((select public.tech_only_tenants())::uuid[]), false));

-- 3. Lo que el técnico sí opera
drop policy if exists "Tecnico administra datos de la escuela" on public.school_details;
create policy "Tecnico administra datos de la escuela" on public.school_details for all
    using (public.my_role_in_tenant(tenant_id) = 'SYSTEM_ADMIN') with check (public.my_role_in_tenant(tenant_id) = 'SYSTEM_ADMIN');
drop policy if exists "Tecnico administra dias especiales" on public.special_schedule_structure;
create policy "Tecnico administra dias especiales" on public.special_schedule_structure for all
    using (tenant_id = public.get_current_tenant_id() and public.my_role_in_tenant(tenant_id) = 'SYSTEM_ADMIN')
    with check (tenant_id = public.get_current_tenant_id() and public.my_role_in_tenant(tenant_id) = 'SYSTEM_ADMIN');

-- Invitaciones: el técnico invita a cualquier puesto excepto directivos y otros técnicos
drop policy if exists "Tecnico gestiona invitaciones" on public.staff_invitations;
create policy "Tecnico gestiona invitaciones" on public.staff_invitations for all
    using (public.my_role_in_tenant(tenant_id) = 'SYSTEM_ADMIN')
    with check (public.my_role_in_tenant(tenant_id) = 'SYSTEM_ADMIN' and upper(role) not in ('DIRECTOR', 'ADMIN', 'SYSTEM_ADMIN', 'SUPER_ADMIN'));
-- Solo dirección (o super admin) puede invitar a un administrador técnico
drop policy if exists "Solo direccion invita tecnicos" on public.staff_invitations;
create policy "Solo direccion invita tecnicos" on public.staff_invitations as restrictive for insert
    with check (upper(role) <> 'SYSTEM_ADMIN' or public.is_god_mode() or public.my_role_in_tenant(tenant_id) in ('DIRECTOR', 'ADMIN'));

create or replace function public.is_import_manager(p_tenant uuid)
returns boolean language sql stable security definer set search_path = public as $$
    select public.is_god_mode() or exists (
        select 1 from public.profile_tenants
        where profile_id = auth.uid() and tenant_id = p_tenant
          and upper(role) in ('DIRECTOR', 'ADMIN', 'SCHOOL_CONTROL', 'ACADEMIC_COORD', 'TECH_COORD', 'SYSTEM_ADMIN'));
$$;

create or replace function private.assert_family_code_manager(p_tenant uuid)
returns void language plpgsql stable security definer set search_path = public as $$
begin
    if auth.uid() is null then raise exception 'Sesión requerida' using errcode = '42501'; end if;
    if public.is_god_mode() then return; end if;
    if not exists (select 1 from public.profile_tenants where profile_id = auth.uid() and tenant_id = p_tenant
                   and upper(role) in ('DIRECTOR', 'ADMIN', 'SCHOOL_CONTROL', 'ACADEMIC_COORD', 'TECH_COORD', 'SYSTEM_ADMIN')) then
        raise exception 'Solo dirección, coordinación, control escolar o el administrador técnico pueden generar los códigos para familias' using errcode = '42501';
    end if;
end $$;

-- Altas y bajas del personal: dirección o técnico (el técnico no toca a directivos ni a otros técnicos)
create or replace function private.assert_school_admin()
returns uuid language plpgsql stable security definer set search_path = public as $$
declare v_tenant uuid := public.get_current_tenant_id();
begin
    if auth.uid() is null or v_tenant is null then raise exception 'Sesión requerida' using errcode = '42501'; end if;
    if not exists (select 1 from profile_tenants where profile_id = auth.uid() and tenant_id = v_tenant
                   and upper(role) in ('DIRECTOR', 'ADMIN', 'SUPER_ADMIN', 'SYSTEM_ADMIN')) and not public.is_god_mode() then
        raise exception 'Solo la dirección o el administrador técnico pueden dar de alta o de baja al personal' using errcode = '42501';
    end if;
    return v_tenant;
end $$;

create or replace function private.assert_can_manage_member(v_tenant uuid, p_profile_id uuid, p_new_role text default null)
returns void language plpgsql stable security definer set search_path = public as $$
declare v_me text := public.my_role_in_tenant(v_tenant); v_target text;
begin
    if v_me is distinct from 'SYSTEM_ADMIN' or public.is_god_mode() then return; end if;
    select upper(role) into v_target from profile_tenants where profile_id = p_profile_id and tenant_id = v_tenant;
    if v_target in ('DIRECTOR', 'ADMIN', 'SYSTEM_ADMIN') then
        raise exception 'El administrador técnico no puede cambiar ni dar de baja a directivos ni a otros técnicos' using errcode = '42501';
    end if;
    if upper(coalesce(p_new_role, '')) in ('DIRECTOR', 'ADMIN', 'SYSTEM_ADMIN') then
        raise exception 'Solo la dirección puede asignar ese puesto' using errcode = '42501';
    end if;
end $$;

create or replace function public.set_staff_role(p_profile_id uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
declare v_tenant uuid := private.assert_school_admin(); v_role text := upper(p_role);
begin
    if v_role not in ('DIRECTOR', 'ADMIN', 'ACADEMIC_COORD', 'TECH_COORD', 'SCHOOL_CONTROL', 'TEACHER', 'PREFECT', 'SUPPORT', 'SYSTEM_ADMIN') then
        raise exception 'Rol no permitido';
    end if;
    if p_profile_id = auth.uid() then raise exception 'No puedes cambiar tu propio rol desde aquí'; end if;
    perform private.assert_can_manage_member(v_tenant, p_profile_id, v_role);
    update profile_tenants set role = v_role where profile_id = p_profile_id and tenant_id = v_tenant;
    update profiles set role = v_role where id = p_profile_id and tenant_id = v_tenant;
end $$;

create or replace function public.remove_staff_member(p_profile_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_tenant uuid := private.assert_school_admin(); v_next uuid; v_next_role text;
begin
    if p_profile_id = auth.uid() then raise exception 'No puedes darte de baja a ti mismo desde aquí'; end if;
    perform private.assert_can_manage_member(v_tenant, p_profile_id, null);
    delete from profile_tenants where profile_id = p_profile_id and tenant_id = v_tenant;
    if exists (select 1 from profiles where id = p_profile_id and tenant_id = v_tenant) then
        select tenant_id, role into v_next, v_next_role from profile_tenants
         where profile_id = p_profile_id order by is_default desc nulls last limit 1;
        update profiles set tenant_id = v_next, role = coalesce(v_next_role, role) where id = p_profile_id;
    end if;
    update group_subjects set teacher_id = null where teacher_id = p_profile_id and tenant_id = v_tenant;
end $$;

-- Aceptar invitaciones de administrador técnico
create or replace function public.accept_invitation(p_token uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_email text; inv record; p record;
begin
    if v_uid is null then raise exception 'Inicia sesión para aceptar la invitación' using errcode = '42501'; end if;
    select email into v_email from auth.users where id = v_uid;
    select * into inv from staff_invitations where token = p_token for update;
    if not found then raise exception 'La invitación no existe'; end if;
    if inv.status <> 'PENDING' then raise exception 'Esta invitación ya se usó'; end if;
    if inv.expires_at <= now() then raise exception 'La invitación venció; pide a la escuela que te envíe una nueva'; end if;
    if lower(inv.email) <> lower(v_email) then raise exception 'Esta invitación es para otro correo'; end if;
    if upper(inv.role) not in ('DIRECTOR', 'ADMIN', 'ACADEMIC_COORD', 'TECH_COORD', 'SCHOOL_CONTROL',
                               'TEACHER', 'PREFECT', 'SUPPORT', 'TUTOR', 'STUDENT', 'SYSTEM_ADMIN') then
        raise exception 'Rol no permitido en la invitación';
    end if;
    select first_name, last_name_paternal, last_name_maternal into p from profiles where id = v_uid;
    insert into profile_tenants (profile_id, tenant_id, role, is_default, first_name, last_name_paternal, last_name_maternal)
    values (v_uid, inv.tenant_id, upper(inv.role), false, p.first_name, p.last_name_paternal, p.last_name_maternal)
    on conflict do nothing;
    update staff_invitations set status = 'ACCEPTED' where id = inv.id;
    update profiles set tenant_id = inv.tenant_id, role = upper(inv.role) where id = v_uid;
    return inv.tenant_id;
end $$;

-- Quien creó la escuela (técnico) cede la dirección cuando el director real ya entró
create or replace function public.hand_over_direction()
returns void language plpgsql security definer set search_path = public as $$
declare v_tenant uuid := public.get_current_tenant_id();
begin
    if auth.uid() is null or v_tenant is null then raise exception 'Sesión requerida' using errcode = '42501'; end if;
    if public.my_role_in_tenant(v_tenant) not in ('DIRECTOR', 'ADMIN') then
        raise exception 'Solo quien tiene el puesto de dirección puede cederlo';
    end if;
    if not exists (select 1 from profile_tenants where tenant_id = v_tenant and profile_id <> auth.uid() and upper(role) = 'DIRECTOR') then
        raise exception 'Primero invita al director o directora y espera a que acepte su invitación';
    end if;
    update profile_tenants set role = 'SYSTEM_ADMIN', job_title = coalesce(job_title, 'Administrador técnico') where profile_id = auth.uid() and tenant_id = v_tenant;
    update profiles set role = 'SYSTEM_ADMIN' where id = auth.uid() and tenant_id = v_tenant;
end $$;
revoke execute on function public.hand_over_direction() from anon;

-- 4. Solicitudes al técnico
create table if not exists public.support_requests (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    created_by uuid not null default auth.uid() references public.profiles(id) on delete cascade,
    kind text not null default 'OTRO',
    title text not null,
    details text,
    status text not null default 'PENDING' check (status in ('PENDING', 'IN_PROGRESS', 'DONE', 'REJECTED', 'CANCELLED')),
    response text,
    handled_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    resolved_at timestamptz
);
create index if not exists support_requests_tenant_idx on public.support_requests(tenant_id, status);
alter table public.support_requests enable row level security;
create policy "Personal crea solicitudes" on public.support_requests for insert
    with check (created_by = auth.uid() and public.is_staff_of(auth.uid(), tenant_id));
create policy "Ver solicitudes" on public.support_requests for select
    using (created_by = auth.uid() or public.is_god_mode() or public.my_role_in_tenant(tenant_id) in ('DIRECTOR', 'ADMIN', 'SYSTEM_ADMIN'));
create policy "Atender solicitudes" on public.support_requests for update
    using (created_by = auth.uid() or public.is_god_mode() or public.my_role_in_tenant(tenant_id) in ('DIRECTOR', 'ADMIN', 'SYSTEM_ADMIN'))
    with check (created_by = auth.uid() or public.is_god_mode() or public.my_role_in_tenant(tenant_id) in ('DIRECTOR', 'ADMIN', 'SYSTEM_ADMIN'));

-- 5. Bitácora de lo que hace el técnico
create table if not exists public.tech_activity_log (
    id bigserial primary key,
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    actor_id uuid,
    table_name text not null,
    action text not null,
    record_label text,
    created_at timestamptz not null default now()
);
create index if not exists tech_activity_log_tenant_idx on public.tech_activity_log(tenant_id, created_at desc);
alter table public.tech_activity_log enable row level security;
create policy "Direccion y tecnico leen la bitacora" on public.tech_activity_log for select
    using (public.is_god_mode() or public.my_role_in_tenant(tenant_id) in ('DIRECTOR', 'ADMIN', 'SYSTEM_ADMIN'));

create or replace function private.log_tech_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare r jsonb; v_tenant uuid; v_label text;
begin
    if tg_op = 'DELETE' then r := to_jsonb(old); else r := to_jsonb(new); end if;
    v_tenant := coalesce((r->>'tenant_id')::uuid, case when tg_table_name = 'tenants' then (r->>'id')::uuid end);
    if v_tenant is null or auth.uid() is null or public.my_role_in_tenant(v_tenant) is distinct from 'SYSTEM_ADMIN' then
        if tg_op = 'DELETE' then return old; end if;
        return new;
    end if;
    v_label := coalesce(
        nullif(trim(concat_ws(' ', r->>'last_name_paternal', r->>'last_name_maternal', r->>'first_name')), ''),
        r->>'full_name', r->>'custom_name', r->>'email', r->>'official_name', r->>'name',
        case when r ? 'grade' and r ? 'section' then concat(r->>'grade', '° ', r->>'section') end,
        case when r ? 'day_of_week' then concat(r->>'day_of_week', ' ', r->>'start_time') end, '');
    insert into public.tech_activity_log (tenant_id, actor_id, table_name, action, record_label)
    values (v_tenant, auth.uid(), tg_table_name, tg_op, left(v_label, 200));
    if tg_op = 'DELETE' then return old; end if;
    return new;
end $$;

do $$
declare t text;
begin
    foreach t in array array['groups','students','guardians','group_subjects','schedules','schedule_settings','academic_years',
                             'evaluation_periods','school_details','staff_invitations','staff_roster','profile_tenants','special_schedule_structure']
    loop
        execute format('drop trigger if exists tr_tech_activity on public.%I', t);
        execute format('create trigger tr_tech_activity after insert or update or delete on public.%I for each row execute function private.log_tech_activity()', t);
    end loop;
end $$;
