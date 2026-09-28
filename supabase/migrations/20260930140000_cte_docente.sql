-- CTE para docentes: consultan las orientaciones de cada sesión, eligen temas, reciben material
-- de apoyo con IA (con su contexto y el seguimiento de sus alumnos) y dan seguimiento a sus
-- compromisos y tareas de cada sesión.

-- El docente independiente administra su propio CTE
create or replace function public.is_cte_manager(p_tenant uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
    select public.is_god_mode()
        or coalesce(public.my_role_in_tenant(p_tenant), '') in ('DIRECTOR', 'ADMIN', 'ACADEMIC_COORD', 'TECH_COORD', 'INDEPENDENT_TEACHER');
$$;

-- Cualquier miembro puede crear las sesiones del calendario oficial (son las mismas para todos)
create or replace function public.cte_ensure_sessions(p_tenant uuid, p_school_year text)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare v_count integer;
begin
    if not public.is_tenant_member(p_tenant) then
        raise exception 'No autorizado' using errcode = '42501';
    end if;
    insert into public.cte_sessions (tenant_id, school_year, session_type, session_number, date, title, official_url)
    select p_tenant, c.school_year, c.session_type, c.session_number, c.date,
           case when c.session_type = 'INTENSIVA' then 'Fase intensiva — sesión ' || c.session_number
                else c.session_number || 'ª sesión ordinaria' end,
           'https://gestion.cte.sep.gob.mx/insumos/'
    from public.cte_calendar c
    where c.school_year = p_school_year
    on conflict (tenant_id, school_year, session_type, session_number) do nothing;
    get diagnostics v_count = row_count;
    return v_count;
end $$;

-- Los docentes consultan las orientaciones e insumos de su escuela
drop policy if exists "Members read cte documents" on public.cte_documents;
create policy "Members read cte documents" on public.cte_documents for select to authenticated using (public.is_tenant_member(tenant_id));
drop policy if exists "Members read cte documents files" on storage.objects;
create policy "Members read cte documents files" on storage.objects for select to authenticated
  using (bucket_id = 'cte_documents' and public.is_tenant_member(public.try_uuid((storage.foldername(name))[1])));
-- Y ven los acuerdos de la escuela
drop policy if exists "Members read cte agreements" on public.cte_agreements;
create policy "Members read cte agreements" on public.cte_agreements for select to authenticated using (public.is_tenant_member(tenant_id));

-- El responsable actualiza el avance de su acuerdo (sin poder cambiar lo demás)
create or replace function public.cte_update_my_agreement(p_id uuid, p_status text, p_follow_up text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_status not in ('PENDIENTE', 'EN_PROCESO', 'CUMPLIDO') then raise exception 'Estado no válido'; end if;
  update cte_agreements set status = p_status, follow_up = left(p_follow_up, 2000), updated_at = now()
  where id = p_id and responsible_profile_id = auth.uid();
  if not found then raise exception 'No autorizado' using errcode = '42501'; end if;
end $$;
revoke all on function public.cte_update_my_agreement(uuid, text, text) from public, anon;
grant execute on function public.cte_update_my_agreement(uuid, text, text) to authenticated;

-- Trabajo del docente por sesión: temas elegidos y material de apoyo generado
create table if not exists public.cte_teacher_work (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  session_id uuid not null references public.cte_sessions(id) on delete cascade,
  profile_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  topics jsonb not null default '[]'::jsonb,
  available_topics jsonb not null default '[]'::jsonb,
  material jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, profile_id)
);
alter table public.cte_teacher_work enable row level security;
drop policy if exists "Own cte work" on public.cte_teacher_work;
create policy "Own cte work" on public.cte_teacher_work for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid() and public.is_tenant_member(tenant_id));

-- Tareas y compromisos personales de cada sesión
create table if not exists public.cte_teacher_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  session_id uuid not null references public.cte_sessions(id) on delete cascade,
  profile_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  kind text not null default 'TAREA' check (kind in ('TAREA', 'COMPROMISO')),
  description text not null check (length(trim(description)) between 2 and 1000),
  due_date date,
  status text not null default 'PENDIENTE' check (status in ('PENDIENTE', 'EN_PROCESO', 'CUMPLIDO')),
  follow_up text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists cte_teacher_tasks_owner on public.cte_teacher_tasks (profile_id, session_id);
alter table public.cte_teacher_tasks enable row level security;
drop policy if exists "Own cte tasks" on public.cte_teacher_tasks;
create policy "Own cte tasks" on public.cte_teacher_tasks for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid() and public.is_tenant_member(tenant_id));
drop policy if exists "Managers read cte tasks" on public.cte_teacher_tasks;
create policy "Managers read cte tasks" on public.cte_teacher_tasks for select to authenticated using (public.is_cte_manager(tenant_id));

-- Resumen anónimo del seguimiento de los alumnos del docente (para que la IA contextualice).
-- No incluye nombres: solo cifras por grupo.
create or replace function public.my_teaching_snapshot(p_days int default 60)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_tenant uuid; v_since date := current_date - greatest(7, least(coalesce(p_days, 60), 365)); v_type text; v_res jsonb;
begin
  select tenant_id into v_tenant from profiles where id = auth.uid();
  select type into v_type from tenants where id = v_tenant;
  with my_groups as (
    select g.id, g.grade, g.section from groups g
    where g.tenant_id = v_tenant and g.archived_at is null and (
      v_type = 'INDEPENDENT'
      or exists (select 1 from group_subjects gs where gs.group_id = g.id and gs.teacher_id = auth.uid())
      or g.id = (select advisory_group_id from profiles where id = auth.uid()))
  ),
  st as (select s.id, s.group_id from students s join my_groups mg on mg.id = s.group_id),
  att as (select a.student_id, a.status from attendance a join st on st.id = a.student_id where a.date >= v_since),
  inc as (select i.student_id, i.type, i.severity from student_incidents i join st on st.id = i.student_id where i.created_at >= v_since),
  gr as (select g.student_id, g.score from grades g join st on st.id = g.student_id where g.is_graded and g.score is not null and g.graded_at >= v_since)
  select jsonb_build_object(
    'days', p_days,
    'groups', coalesce((select jsonb_agg(jsonb_build_object(
        'group', mg.grade || '° ' || mg.section,
        'students', (select count(*) from st where st.group_id = mg.id),
        'attendance_rate', (select round(100.0 * count(*) filter (where att.status in ('PRESENT', 'LATE')) / nullif(count(*), 0), 1) from att join st on st.id = att.student_id where st.group_id = mg.id),
        'students_3plus_absences', (select count(*) from (select att.student_id from att join st on st.id = att.student_id where st.group_id = mg.id and att.status = 'ABSENT' group by att.student_id having count(*) >= 3) x),
        'incidents', (select count(*) from inc join st on st.id = inc.student_id where st.group_id = mg.id and inc.type <> 'POSITIVO'),
        'incidents_by_type', (select jsonb_object_agg(t, n) from (select inc.type t, count(*) n from inc join st on st.id = inc.student_id where st.group_id = mg.id group by inc.type) y),
        'grade_average', (select round(avg(gr.score), 1) from gr join st on st.id = gr.student_id where st.group_id = mg.id),
        'students_below_6', (select count(*) from (select gr.student_id from gr join st on st.id = gr.student_id where st.group_id = mg.id group by gr.student_id having avg(gr.score) < 6) z)
      ) order by mg.grade, mg.section) from my_groups mg), '[]'::jsonb),
    'subjects', coalesce((select jsonb_agg(distinct coalesce(sc.name, ps.custom_detail)) from profile_subjects ps left join subject_catalog sc on sc.id = ps.subject_catalog_id where ps.profile_id = auth.uid()), '[]'::jsonb)
  ) into v_res;
  return v_res;
end $$;
revoke all on function public.my_teaching_snapshot(int) from public, anon;
grant execute on function public.my_teaching_snapshot(int) to authenticated;
