-- Bitácora de incidencias completa (folio, pactos, avances, evidencias, catálogo, hojas prefoliadas),
-- diagnóstico y encuesta socioemocional de la escuela, y bitácora de la dirección
-- (atención a familias, visitas áulicas de acompañamiento, seguimiento).

-- Directivos del plantel: dirección y coordinaciones.
create or replace function public.is_school_lead(p_tenant uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
    select public.is_god_mode() or exists (
        select 1 from public.profile_tenants
        where profile_id = auth.uid() and tenant_id = p_tenant
          and upper(role) in ('DIRECTOR', 'ADMIN', 'ACADEMIC_COORD', 'TECH_COORD'));
$$;

-- ───────────────────────────── Folios consecutivos por escuela
create table if not exists public.tenant_folios (
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    kind text not null,
    last_folio integer not null default 0,
    primary key (tenant_id, kind)
);
alter table public.tenant_folios enable row level security; -- sin políticas: solo lo usan las funciones

create or replace function public.next_folio(p_tenant uuid, p_kind text)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare v integer;
begin
    insert into tenant_folios (tenant_id, kind, last_folio) values (p_tenant, p_kind, 1)
    on conflict (tenant_id, kind) do update set last_folio = tenant_folios.last_folio + 1
    returning last_folio into v;
    return v;
end $$;
revoke all on function public.next_folio(uuid, text) from public, anon, authenticated;

-- ───────────────────────────── Incidencias
alter table public.student_incidents
    add column if not exists folio integer,
    add column if not exists occurred_at timestamptz,
    add column if not exists place text,
    add column if not exists involved text,
    add column if not exists catalog_item text,
    add column if not exists agreements jsonb not null default '[]'::jsonb,
    add column if not exists evidence jsonb not null default '[]'::jsonb;

-- Las incidencias que ya existían reciben su folio en el orden en que se registraron
update public.student_incidents i set folio = x.n
from (select id, row_number() over (partition by tenant_id order by created_at, id) n from public.student_incidents where folio is null) x
where x.id = i.id;
insert into public.tenant_folios (tenant_id, kind, last_folio)
select tenant_id, 'INCIDENCIA', max(folio) from public.student_incidents where folio is not null group by tenant_id
on conflict (tenant_id, kind) do nothing;
create unique index if not exists student_incidents_folio_key on public.student_incidents (tenant_id, folio);

-- Hojas en blanco prefoliadas: folios apartados para llenarse a mano y capturarse después
create table if not exists public.incident_blank_folios (
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    folio integer not null,
    reserved_by uuid default auth.uid(),
    reserved_at timestamptz not null default now(),
    incident_id uuid,
    primary key (tenant_id, folio)
);
alter table public.incident_blank_folios enable row level security;
create policy "Personal lee folios apartados" on public.incident_blank_folios for select
    using (public.is_staff_of(auth.uid(), tenant_id) or public.is_god_mode());

create or replace function public.incident_set_folio()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
    if tg_op = 'UPDATE' then
        new.folio := old.folio; -- el folio no se cambia nunca
        return new;
    end if;
    if new.folio is not null then
        update incident_blank_folios set incident_id = new.id
        where tenant_id = new.tenant_id and folio = new.folio and incident_id is null;
        if not found then raise exception 'El folio % no está apartado o ya se usó', new.folio; end if;
    else
        new.folio := next_folio(new.tenant_id, 'INCIDENCIA');
    end if;
    if new.occurred_at is null then new.occurred_at := coalesce(new.created_at, now()); end if;
    return new;
end $$;
create trigger incident_set_folio before insert or update on public.student_incidents
    for each row execute function public.incident_set_folio();

create or replace function public.reserve_incident_folios(p_count integer)
returns integer[] language plpgsql security definer set search_path to 'public' as $$
declare v_tenant uuid := get_current_tenant_id(); f integer; out_f integer[] := '{}';
begin
    if v_tenant is null or not is_staff_of(auth.uid(), v_tenant) then raise exception 'No autorizado'; end if;
    if p_count is null or p_count < 1 or p_count > 40 then raise exception 'Se pueden apartar de 1 a 40 hojas a la vez'; end if;
    for i in 1..p_count loop
        f := next_folio(v_tenant, 'INCIDENCIA');
        insert into incident_blank_folios (tenant_id, folio) values (v_tenant, f);
        out_f := out_f || f;
    end loop;
    return out_f;
end $$;
revoke all on function public.reserve_incident_folios(integer) from public, anon;
grant execute on function public.reserve_incident_folios(integer) to authenticated;

-- Control de avances: cada nota queda con fecha y autor; no se edita ni se borra
create table if not exists public.incident_followups (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    incident_id uuid not null references public.student_incidents(id) on delete cascade,
    note text not null,
    progress text not null default 'EN_PROCESO' check (progress in ('SIN_AVANCE', 'EN_PROCESO', 'CUMPLIDO')),
    created_by uuid default auth.uid() references public.profiles(id) on delete set null,
    author_name text,
    created_at timestamptz not null default now()
);
create index if not exists incident_followups_incident on public.incident_followups (incident_id, created_at);
alter table public.incident_followups enable row level security;
create policy "Personal lee avances" on public.incident_followups for select
    using (public.is_staff_of(auth.uid(), tenant_id) or public.is_god_mode());
create policy "Personal anota avances" on public.incident_followups for insert
    with check (public.is_staff_of(auth.uid(), tenant_id) and created_by = auth.uid());

-- Catálogo de incidencias propio de la escuela (el catálogo base viene en la aplicación)
create table if not exists public.incident_catalog (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    name text not null,
    type text not null check (type in ('CONDUCTA', 'ACADEMICO', 'EMOCIONAL', 'POSITIVO', 'SALUD')),
    severity text not null check (severity in ('BAJA', 'MEDIA', 'ALTA')),
    measure text,
    active boolean not null default true,
    created_by uuid default auth.uid(),
    created_at timestamptz not null default now()
);
create unique index if not exists incident_catalog_name on public.incident_catalog (tenant_id, lower(name));
alter table public.incident_catalog enable row level security;
create policy "Personal lee catálogo de incidencias" on public.incident_catalog for select
    using (public.is_staff_of(auth.uid(), tenant_id) or public.is_god_mode());
create policy "Directivos y prefectura administran catálogo" on public.incident_catalog for all
    using (public.is_school_lead(tenant_id) or upper(coalesce(public.my_role_in_tenant(tenant_id), '')) = 'PREFECT')
    with check (public.is_school_lead(tenant_id) or upper(coalesce(public.my_role_in_tenant(tenant_id), '')) = 'PREFECT');

-- Evidencias (fotos y documentos): carpeta privada por escuela, solo personal
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('school_evidence', 'school_evidence', false, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;
create policy "Evidencias: personal lee" on storage.objects for select
    using (bucket_id = 'school_evidence' and public.is_staff_of(auth.uid(), public.try_uuid((storage.foldername(name))[1])));
create policy "Evidencias: personal sube" on storage.objects for insert
    with check (bucket_id = 'school_evidence' and public.is_staff_of(auth.uid(), public.try_uuid((storage.foldername(name))[1])));

-- ───────────────────────────── Diagnóstico y encuesta socioemocional
create table if not exists public.school_instruments (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    school_year text not null,
    kind text not null check (kind in ('DIAGNOSTICO', 'SOCIOEMOCIONAL')),
    title text not null,
    grade text,
    subject text,
    instructions text,
    items jsonb not null default '[]'::jsonb,
    status text not null default 'DRAFT' check (status in ('DRAFT', 'PUBLISHED', 'CLOSED')),
    created_by uuid default auth.uid(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index if not exists school_instruments_tenant on public.school_instruments (tenant_id, school_year);
alter table public.school_instruments enable row level security;
create policy "Personal lee instrumentos" on public.school_instruments for select
    using (public.is_staff_of(auth.uid(), tenant_id) or public.is_god_mode());
create policy "Directivos administran instrumentos" on public.school_instruments for all
    using (public.is_school_lead(tenant_id)) with check (public.is_school_lead(tenant_id));

create table if not exists public.instrument_results (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    instrument_id uuid not null references public.school_instruments(id) on delete cascade,
    student_id uuid not null references public.students(id) on delete cascade,
    group_id uuid,
    answers jsonb not null default '{}'::jsonb,
    absent boolean not null default false,
    captured_by uuid default auth.uid(),
    updated_at timestamptz not null default now(),
    unique (instrument_id, student_id)
);
alter table public.instrument_results enable row level security;
create policy "Personal lee resultados" on public.instrument_results for select
    using (public.is_staff_of(auth.uid(), tenant_id) or public.is_god_mode());
create policy "Personal captura resultados" on public.instrument_results for insert
    with check (public.is_staff_of(auth.uid(), tenant_id));
create policy "Personal corrige resultados" on public.instrument_results for update
    using (public.is_staff_of(auth.uid(), tenant_id)) with check (public.is_staff_of(auth.uid(), tenant_id));

-- ───────────────────────────── Bitácora de la dirección
create table if not exists public.direction_log (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    folio integer,
    kind text not null check (kind in ('REUNION_FAMILIA', 'ATENCION', 'SEGUIMIENTO_DOCENTE', 'SEGUIMIENTO_ALUMNO')),
    area text not null check (area in ('DIRECCION', 'SUBDIRECCION', 'COORDINACION')),
    occurred_at timestamptz not null default now(),
    attendees text,
    student_id uuid references public.students(id) on delete set null,
    teacher_id uuid references public.profiles(id) on delete set null,
    subject text not null,
    facts text,
    agreements jsonb not null default '[]'::jsonb,
    next_date date,
    status text not null default 'ABIERTO' check (status in ('ABIERTO', 'CERRADO')),
    created_by uuid default auth.uid(),
    author_name text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index if not exists direction_log_tenant on public.direction_log (tenant_id, occurred_at desc);
alter table public.direction_log enable row level security;
create policy "Directivos llevan la bitácora" on public.direction_log for all
    using (public.is_school_lead(tenant_id)) with check (public.is_school_lead(tenant_id));

create table if not exists public.classroom_visits (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    folio integer,
    teacher_id uuid not null references public.profiles(id) on delete cascade,
    group_id uuid references public.groups(id) on delete set null,
    subject text,
    scheduled_date date not null,
    scheduled_time time,
    purpose text,
    status text not null default 'PROGRAMADA' check (status in ('PROGRAMADA', 'REALIZADA', 'RETROALIMENTADA', 'CERRADA')),
    observer_id uuid default auth.uid(),
    observer_name text,
    indicators jsonb not null default '[]'::jsonb,
    facts text,
    evidence jsonb not null default '[]'::jsonb,
    feedback_date date,
    teacher_comment text,
    agreements jsonb not null default '[]'::jsonb,
    next_review date,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index if not exists classroom_visits_tenant on public.classroom_visits (tenant_id, scheduled_date desc);
alter table public.classroom_visits enable row level security;
create policy "Directivos organizan visitas" on public.classroom_visits for all
    using (public.is_school_lead(tenant_id)) with check (public.is_school_lead(tenant_id));
create policy "Docente ve sus visitas" on public.classroom_visits for select
    using (teacher_id = auth.uid());

create or replace function public.direction_set_folio()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
    if tg_op = 'UPDATE' then
        new.folio := old.folio; new.updated_at := now();
        return new;
    end if;
    new.folio := next_folio(new.tenant_id, tg_argv[0]);
    return new;
end $$;
create trigger direction_log_folio before insert or update on public.direction_log
    for each row execute function public.direction_set_folio('DIRECCION');
create trigger classroom_visits_folio before insert or update on public.classroom_visits
    for each row execute function public.direction_set_folio('VISITA');

-- Indicadores de visita que agrega la escuela o pide la autoridad (los de base vienen en la aplicación)
create table if not exists public.visit_indicators (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    area text not null,
    text text not null,
    source text not null default 'ESCUELA' check (source in ('ESCUELA', 'AUTORIDAD')),
    active boolean not null default true,
    created_by uuid default auth.uid(),
    created_at timestamptz not null default now()
);
alter table public.visit_indicators enable row level security;
create policy "Directivos administran indicadores" on public.visit_indicators for all
    using (public.is_school_lead(tenant_id)) with check (public.is_school_lead(tenant_id));

-- Alumnos en riesgo por calificaciones, conducta e inasistencias (lo socioemocional lo suma la aplicación)
create or replace function public.students_at_risk()
returns table (student_id uuid, failing integer, failing_subjects text[], conduct integer, severe integer, absences integer)
language sql stable security definer set search_path to 'public' as $$
    with t as (select get_current_tenant_id() id),
    ok as (select t.id from t where is_school_lead(t.id) or upper(coalesce(my_role_in_tenant(t.id), '')) in ('PREFECT', 'SUPPORT', 'SOCIAL_WORKER')),
    avgs as (
        select g.student_id, a.subject_id, avg(g.score) av
        from grades g join assignments a on a.id = g.assignment_id
        where g.tenant_id = (select id from ok) and g.score is not null and g.is_graded is not false and a.subject_id is not null
        group by 1, 2),
    fail as (
        select v.student_id, count(*)::int n, array_agg(coalesce(sc.name, 'Materia') order by sc.name) names
        from avgs v left join subject_catalog sc on sc.id = v.subject_id where v.av < 6 group by 1),
    inc as (
        select i.student_id,
               count(*) filter (where i.type = 'CONDUCTA' and i.created_at > now() - interval '60 days')::int conduct,
               count(*) filter (where i.severity = 'ALTA' and i.status = 'OPEN')::int severe
        from student_incidents i where i.tenant_id = (select id from ok) group by 1),
    att as (
        select a.student_id, count(*)::int n from attendance a
        where a.tenant_id = (select id from ok) and a.status = 'ABSENT' and a.date > current_date - 30 group by 1)
    select s.id, coalesce(f.n, 0), coalesce(f.names, '{}'), coalesce(i.conduct, 0), coalesce(i.severe, 0), coalesce(att.n, 0)
    from students s
    left join fail f on f.student_id = s.id
    left join inc i on i.student_id = s.id
    left join att on att.student_id = s.id
    where s.tenant_id = (select id from ok)
      and (coalesce(f.n, 0) > 0 or coalesce(i.conduct, 0) >= 3 or coalesce(i.severe, 0) > 0 or coalesce(att.n, 0) >= 4);
$$;
revoke all on function public.students_at_risk() from public, anon;
grant execute on function public.students_at_risk() to authenticated;
