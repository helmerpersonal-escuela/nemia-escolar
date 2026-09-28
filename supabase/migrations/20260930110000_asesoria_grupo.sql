-- Asesoría de grupo: el docente asesor da seguimiento a la conducta, asistencia y compromisos
-- del grupo que asesora aunque no le imparta clase. Solo lectura y solo de SU grupo asesorado.
create or replace function public.my_advisory_group(p_days int default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_group uuid;
  v_tenant uuid;
  v_since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)));
  v_result jsonb;
begin
  select advisory_group_id, tenant_id into v_group, v_tenant from profiles where id = auth.uid();
  if v_group is null then return null; end if;
  if not exists (select 1 from groups g where g.id = v_group and g.tenant_id = v_tenant) then return null; end if;

  with st as (
    select s.id, s.first_name, s.last_name_paternal, s.last_name_maternal, s.photo_url
    from students s where s.group_id = v_group and coalesce(s.status, 'ACTIVE') not in ('BAJA', 'INACTIVE', 'ARCHIVED')
  ),
  inc as (
    select i.* from student_incidents i
    join st on st.id = i.student_id
    where i.tenant_id = v_tenant and (coalesce(i.is_private, false) = false or i.teacher_id = auth.uid())
  ),
  att as (
    select a.student_id, a.status from attendance a join st on st.id = a.student_id
    where a.tenant_id = v_tenant and a.date >= v_since::date
  )
  select jsonb_build_object(
    'group', (select jsonb_build_object('id', g.id, 'grade', g.grade, 'section', g.section, 'shift', g.shift) from groups g where g.id = v_group),
    'days', p_days,
    'students', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', st.id,
        'name', trim(concat_ws(' ', st.first_name, st.last_name_paternal, st.last_name_maternal)),
        'photo_url', st.photo_url,
        'incidents', (select count(*) from inc where inc.student_id = st.id and inc.created_at >= v_since and inc.type <> 'POSITIVO'),
        'severe', (select count(*) from inc where inc.student_id = st.id and inc.created_at >= v_since and inc.severity = 'ALTA'),
        'positive', (select count(*) from inc where inc.student_id = st.id and inc.created_at >= v_since and inc.type = 'POSITIVO'),
        'open_commitments', (select count(*) from inc where inc.student_id = st.id and inc.has_commitment and coalesce(inc.status, 'OPEN') not in ('RESOLVED', 'CLOSED', 'CERRADO', 'RESUELTO')),
        'absences', (select count(*) from att where att.student_id = st.id and att.status = 'ABSENT'),
        'lates', (select count(*) from att where att.student_id = st.id and att.status = 'LATE'),
        'last_incident_at', (select max(created_at) from inc where inc.student_id = st.id)
      ) order by st.last_name_paternal, st.last_name_maternal, st.first_name)
      from st), '[]'::jsonb),
    'recent', coalesce((
      select jsonb_agg(r order by (r->>'created_at') desc) from (
        select jsonb_build_object(
          'id', inc.id, 'student_id', inc.student_id,
          'student', trim(concat_ws(' ', st.first_name, st.last_name_paternal)),
          'title', inc.title, 'type', inc.type, 'severity', inc.severity, 'status', inc.status,
          'description', left(coalesce(inc.description, ''), 400),
          'has_commitment', inc.has_commitment, 'commitment', inc.commitment_description,
          'teacher', trim(concat_ws(' ', p.first_name, p.last_name_paternal)),
          'created_at', inc.created_at) r
        from inc join st on st.id = inc.student_id
        left join profiles p on p.id = inc.teacher_id
        where inc.created_at >= v_since
        order by inc.created_at desc limit 50) x), '[]'::jsonb)
  ) into v_result;
  return v_result;
end $$;

revoke all on function public.my_advisory_group(int) from public, anon;
grant execute on function public.my_advisory_group(int) to authenticated;
