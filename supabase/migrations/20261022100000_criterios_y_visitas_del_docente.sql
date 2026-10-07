-- Criterios de la escuela para detectar riesgo e interpretar el diagnóstico y la encuesta (antes eran fijos),
-- y comentario del docente sobre su visita de acompañamiento.
create table if not exists public.school_criteria (
    tenant_id uuid primary key references public.tenants(id) on delete cascade,
    risk_min_average numeric(4,1) not null default 6 check (risk_min_average between 1 and 10),
    risk_conduct_count integer not null default 3 check (risk_conduct_count between 1 and 20),
    risk_conduct_days integer not null default 60 check (risk_conduct_days between 7 and 365),
    risk_absences integer not null default 4 check (risk_absences between 1 and 60),
    risk_absence_days integer not null default 30 check (risk_absence_days between 7 and 365),
    diag_expected integer not null default 80 check (diag_expected between 1 and 100),
    diag_support integer not null default 60 check (diag_support between 0 and 99),
    socio_expected numeric(3,1) not null default 3.0 check (socio_expected between 1 and 4),
    socio_support numeric(3,1) not null default 2.2 check (socio_support between 1 and 4),
    updated_by uuid default auth.uid(),
    updated_at timestamptz not null default now(),
    check (diag_support < diag_expected),
    check (socio_support < socio_expected)
);
alter table public.school_criteria enable row level security;
create policy "Personal lee criterios" on public.school_criteria for select
    using (public.is_staff_of(auth.uid(), tenant_id) or public.is_god_mode());
create policy "Directivos definen criterios" on public.school_criteria for all
    using (public.is_school_lead(tenant_id)) with check (public.is_school_lead(tenant_id));

create or replace function public.students_at_risk()
returns table (student_id uuid, failing integer, failing_subjects text[], conduct integer, severe integer, absences integer)
language sql stable security definer set search_path to 'public' as $$
    with t as (select get_current_tenant_id() id),
    ok as (select t.id from t where is_school_lead(t.id) or upper(coalesce(my_role_in_tenant(t.id), '')) in ('PREFECT', 'SUPPORT', 'SOCIAL_WORKER')),
    c as (
        select coalesce(max(sc.risk_min_average), 6) min_avg, coalesce(max(sc.risk_conduct_count), 3) n_conduct, coalesce(max(sc.risk_conduct_days), 60) d_conduct,
               coalesce(max(sc.risk_absences), 4) n_abs, coalesce(max(sc.risk_absence_days), 30) d_abs
        from school_criteria sc where sc.tenant_id = (select id from ok)),
    avgs as (
        select g.student_id, a.subject_id, avg(g.score) av
        from grades g join assignments a on a.id = g.assignment_id
        where g.tenant_id = (select id from ok) and g.score is not null and g.is_graded is not false and a.subject_id is not null
        group by 1, 2),
    fail as (
        select v.student_id, count(*)::int n, array_agg(coalesce(sc.name, 'Materia') order by sc.name) names
        from avgs v left join subject_catalog sc on sc.id = v.subject_id where v.av < (select min_avg from c) group by 1),
    inc as (
        select i.student_id,
               count(*) filter (where i.type = 'CONDUCTA' and i.created_at > now() - make_interval(days => (select d_conduct from c)))::int conduct,
               count(*) filter (where i.severity = 'ALTA' and i.status = 'OPEN')::int severe
        from student_incidents i where i.tenant_id = (select id from ok) group by 1),
    att as (
        select a.student_id, count(*)::int n from attendance a
        where a.tenant_id = (select id from ok) and a.status = 'ABSENT' and a.date > current_date - (select d_abs from c) group by 1)
    select s.id, coalesce(f.n, 0), coalesce(f.names, '{}'), coalesce(i.conduct, 0), coalesce(i.severe, 0), coalesce(att.n, 0)
    from students s
    left join fail f on f.student_id = s.id
    left join inc i on i.student_id = s.id
    left join att on att.student_id = s.id
    where s.tenant_id = (select id from ok)
      and (coalesce(f.n, 0) > 0 or coalesce(i.conduct, 0) >= (select n_conduct from c) or coalesce(i.severe, 0) > 0 or coalesce(att.n, 0) >= (select n_abs from c));
$$;

alter table public.classroom_visits
    add column if not exists teacher_note text,
    add column if not exists teacher_note_at timestamptz;

-- El docente solo puede escribir su propio comentario; lo demás de la visita lo lleva el directivo
create or replace function public.visit_add_teacher_note(p_visit uuid, p_note text)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
    if char_length(coalesce(trim(p_note), '')) < 3 then raise exception 'Escribe tu comentario'; end if;
    update classroom_visits set teacher_note = left(trim(p_note), 4000), teacher_note_at = now()
    where id = p_visit and teacher_id = auth.uid() and status <> 'CERRADA';
    if not found then raise exception 'No se puede comentar esta visita'; end if;
end $$;
revoke all on function public.visit_add_teacher_note(uuid, text) from public, anon;
grant execute on function public.visit_add_teacher_note(uuid, text) to authenticated;
