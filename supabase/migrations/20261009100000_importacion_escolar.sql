-- Importación de la información que ya tiene la escuela (listas, directorios, horarios, personal,
-- comisiones, CTE, PEMC e historial). Agrega lo que el sistema no tenía para guardarla.

-- Quién puede importar y administrar la plantilla: dirección, administración, control escolar y coordinaciones
create or replace function public.is_import_manager(p_tenant uuid)
returns boolean language sql stable security definer set search_path = public as $$
    select public.is_god_mode() or exists (
        select 1 from public.profile_tenants
        where profile_id = auth.uid() and tenant_id = p_tenant
          and upper(role) in ('DIRECTOR', 'ADMIN', 'SCHOOL_CONTROL', 'ACADEMIC_COORD', 'TECH_COORD'));
$$;
revoke execute on function public.is_import_manager(uuid) from anon;

-- 1. Plantilla de personal: personas de la escuela aunque todavía no tengan cuenta ni correo
create table if not exists public.staff_roster (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    full_name text not null,
    first_name text,
    last_name_paternal text,
    last_name_maternal text,
    name_key text not null,
    role_hint text not null default 'TEACHER',
    job_title text,
    subjects text[] not null default '{}',
    groups text[] not null default '{}',
    weekly_hours integer,
    duties text,
    email text,
    profile_id uuid references public.profiles(id) on delete set null,
    invitation_id uuid references public.staff_invitations(id) on delete set null,
    source text,
    created_by uuid default auth.uid(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (tenant_id, name_key)
);
alter table public.staff_roster enable row level security;
create policy "Gestores leen la plantilla" on public.staff_roster for select using (public.is_import_manager(tenant_id));
create policy "Gestores administran la plantilla" on public.staff_roster for all
    using (public.is_import_manager(tenant_id)) with check (public.is_import_manager(tenant_id));

-- Docente previsto para cada materia de cada grupo (se asigna solo cuando la persona entra)
alter table public.group_subjects add column if not exists planned_roster_id uuid references public.staff_roster(id) on delete set null;
alter table public.staff_invitations add column if not exists roster_id uuid references public.staff_roster(id) on delete set null;
create index if not exists group_subjects_planned_roster_idx on public.group_subjects(planned_roster_id) where planned_roster_id is not null;

-- Cuando una persona de la plantilla queda ligada a su cuenta, recibe sus grupos y materias
create or replace function private.roster_assign_subjects()
returns trigger language plpgsql security definer set search_path = public as $$
begin
    if new.profile_id is not null and new.profile_id is distinct from old.profile_id then
        update public.group_subjects
           set teacher_id = new.profile_id
         where planned_roster_id = new.id and teacher_id is null;
    end if;
    return new;
end;
$$;
drop trigger if exists tr_roster_assign_subjects on public.staff_roster;
create trigger tr_roster_assign_subjects after update of profile_id on public.staff_roster
    for each row execute function private.roster_assign_subjects();

-- Al aceptar una invitación hecha desde la plantilla, se liga la cuenta con esa persona
create or replace function private.invitation_links_roster()
returns trigger language plpgsql security definer set search_path = public as $$
begin
    if new.status = 'ACCEPTED' and old.status is distinct from 'ACCEPTED' and new.roster_id is not null and auth.uid() is not null then
        update public.staff_roster set profile_id = auth.uid(), updated_at = now()
         where id = new.roster_id and profile_id is null;
    end if;
    return new;
end;
$$;
drop trigger if exists tr_invitation_links_roster on public.staff_invitations;
create trigger tr_invitation_links_roster after update of status on public.staff_invitations
    for each row execute function private.invitation_links_roster();

-- 2. Comisiones del ciclo (presidente, secretario, vocales…)
create table if not exists public.school_commissions (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    school_year text not null,
    name text not null,
    members jsonb not null default '[]',
    source text,
    created_by uuid default auth.uid(),
    created_at timestamptz not null default now(),
    unique (tenant_id, school_year, name)
);
alter table public.school_commissions enable row level security;
create policy "Personal lee comisiones" on public.school_commissions for select using (public.is_staff_of(auth.uid(), tenant_id) or public.is_god_mode());
create policy "Gestores administran comisiones" on public.school_commissions for all
    using (public.is_import_manager(tenant_id)) with check (public.is_import_manager(tenant_id));

-- 3. Antecedentes académicos (promedios de ciclos anteriores, adeudos, bajas y altas)
create table if not exists public.student_history (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    student_id uuid references public.students(id) on delete cascade,
    student_name text not null,
    school_year text,
    grade_group text,
    kind text not null check (kind in ('PROMEDIOS', 'ADEUDO', 'BAJA', 'ALTA', 'NOTA')),
    data jsonb not null default '{}',
    source text,
    created_by uuid default auth.uid(),
    created_at timestamptz not null default now()
);
create index if not exists student_history_student_idx on public.student_history(student_id);
create index if not exists student_history_tenant_idx on public.student_history(tenant_id, kind);
alter table public.student_history enable row level security;
create policy "Personal lee antecedentes" on public.student_history for select using (public.is_staff_of(auth.uid(), tenant_id) or public.is_god_mode());
create policy "Gestores administran antecedentes" on public.student_history for all
    using (public.is_import_manager(tenant_id)) with check (public.is_import_manager(tenant_id));

-- 4. PEMC: datos que traen los documentos de la escuela
alter table public.pemc_objectives add column if not exists area text;
alter table public.pemc_objectives add column if not exists problem text;
alter table public.pemc_objectives add column if not exists indicator text;
alter table public.pemc_objectives add column if not exists source text;
alter table public.pemc_actions add column if not exists responsible_label text;
alter table public.pemc_actions add column if not exists period_label text;
alter table public.pemc_actions add column if not exists stage text;
alter table public.pemc_actions add column if not exists progress_label text;
