-- Credenciales de alumnos con NFC / QR y pase de lista rápido ("modo escucha").
-- La credencial lleva un código opaco (no la CURP): si alguien la lee con su celular no obtiene datos del alumno.
create table if not exists public.student_cards (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    student_id uuid not null references public.students(id) on delete cascade,
    code text not null,
    kind text not null default 'TOKEN' check (kind in ('TOKEN', 'NFC_UID', 'READER')),
    created_by uuid default auth.uid(),
    created_at timestamptz not null default now(),
    unique (tenant_id, code)
);
create index if not exists idx_student_cards_student on public.student_cards(student_id);
alter table public.student_cards enable row level security;
create policy "Personal ve credenciales" on public.student_cards for select to authenticated
    using (public.is_god_mode() or public.is_staff_of(auth.uid(), tenant_id));
create policy "Personal registra credenciales" on public.student_cards for insert to authenticated
    with check (public.is_staff_of(auth.uid(), tenant_id) and exists (select 1 from public.students s where s.id = student_id and s.tenant_id = student_cards.tenant_id));
create policy "Personal quita credenciales" on public.student_cards for delete to authenticated
    using (public.is_god_mode() or public.my_role_in_tenant(tenant_id) in ('DIRECTOR', 'ADMIN', 'SYSTEM_ADMIN', 'SCHOOL_CONTROL', 'PREFECT'));

-- Entrega de tareas con la credencial
alter table public.grades add column if not exists delivered_at timestamptz;

-- Normaliza lo leído: URL de la etiqueta (…/c/CODIGO), "VK:CODIGO" del QR, número de serie o lo que teclea un lector USB
create or replace function private.card_code(p text)
returns text language sql immutable set search_path to 'public' as $$
    select upper(regexp_replace(regexp_replace(regexp_replace(trim(coalesce(p, '')), '^.*/c/', ''), '^VK:', '', 'i'), '[^A-Za-z0-9]', '', 'g'));
$$;

-- Crea el código de credencial de los alumnos de un grupo que aún no lo tienen y devuelve todos
create or replace function public.ensure_card_tokens(p_group uuid)
returns table(student_id uuid, token text) language plpgsql security definer set search_path to 'public' as $$
declare v_tenant uuid;
begin
    select g.tenant_id into v_tenant from groups g where g.id = p_group;
    if v_tenant is null or not (public.is_god_mode() or public.is_staff_of(auth.uid(), v_tenant)) then
        raise exception 'Sin permiso' using errcode = '42501';
    end if;
    insert into student_cards (tenant_id, student_id, code, kind)
    select v_tenant, s.id, upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)), 'TOKEN'
      from students s
     where s.group_id = p_group
       and not exists (select 1 from student_cards c where c.student_id = s.id and c.kind = 'TOKEN');
    return query select c.student_id, c.code from student_cards c join students s on s.id = c.student_id
                  where s.group_id = p_group and c.kind = 'TOKEN';
end $$;
revoke all on function public.ensure_card_tokens(uuid) from public, anon;
grant execute on function public.ensure_card_tokens(uuid) to authenticated;

-- Liga a un alumno el número de serie de su etiqueta NFC o lo que escribe el lector USB (una etiqueta = un alumno)
create or replace function public.link_card(p_student uuid, p_code text, p_kind text default 'NFC_UID')
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_tenant uuid; v_code text := private.card_code(p_code);
begin
    select tenant_id into v_tenant from students where id = p_student;
    if v_tenant is null or not (public.is_god_mode() or public.is_staff_of(auth.uid(), v_tenant)) then
        raise exception 'Sin permiso' using errcode = '42501';
    end if;
    if length(v_code) < 4 then raise exception 'No se leyó la credencial'; end if;
    if upper(p_kind) not in ('NFC_UID', 'READER') then raise exception 'Tipo no válido'; end if;
    insert into student_cards (tenant_id, student_id, code, kind) values (v_tenant, p_student, v_code, upper(p_kind))
    on conflict (tenant_id, code) do update set student_id = excluded.student_id, kind = excluded.kind, created_by = auth.uid(), created_at = now();
end $$;
revoke all on function public.link_card(uuid, text, text) from public, anon;
grant execute on function public.link_card(uuid, text, text) to authenticated;

-- Registrar entrada con la credencial (control de acceso o pase de lista). No sobrescribe un registro existente,
-- salvo que estuviera como falta: quien llega después queda con el estado indicado (p. ej. retardo).
create or replace function public.card_check_in(p_code text, p_status text default 'PRESENT', p_subject uuid default null, p_group uuid default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_tenant uuid := public.get_current_tenant_id(); v_code text := private.card_code(p_code);
        st record; v_status text := upper(coalesce(p_status, 'PRESENT')); v_date date := (now() at time zone 'America/Mexico_City')::date;
        v_prev text; v_new boolean := false;
begin
    if auth.uid() is null or v_tenant is null then raise exception 'Sesión requerida' using errcode = '42501'; end if;
    if not public.is_staff_of(auth.uid(), v_tenant) or v_tenant = any(public.tech_only_tenants()) then
        raise exception 'Tu puesto no registra asistencia' using errcode = '42501';
    end if;
    if v_status not in ('PRESENT', 'LATE') then raise exception 'Estado no válido'; end if;
    select s.id, s.first_name, s.last_name_paternal, s.group_id, g.grade::text as grade, g.section::text as section, s.photo_url
      into st
      from student_cards c join students s on s.id = c.student_id left join groups g on g.id = s.group_id
     where c.tenant_id = v_tenant and c.code = v_code
     limit 1;
    if not found then
        select s.id, s.first_name, s.last_name_paternal, s.group_id, g.grade::text as grade, g.section::text as section, s.photo_url
          into st from students s left join groups g on g.id = s.group_id
         where s.tenant_id = v_tenant and (upper(coalesce(s.curp, '')) = v_code or replace(upper(s.id::text), '-', '') = v_code) limit 1;
    end if;
    if st.id is null then return jsonb_build_object('found', false); end if;
    if st.group_id is null then return jsonb_build_object('found', true, 'error', 'El alumno no tiene grupo', 'name', st.first_name || ' ' || st.last_name_paternal); end if;
    if p_group is not null and st.group_id <> p_group then
        return jsonb_build_object('found', true, 'other_group', true, 'name', st.first_name || ' ' || st.last_name_paternal, 'group', st.grade || '° ' || st.section);
    end if;
    select status into v_prev from attendance
     where student_id = st.id and date = v_date and group_id = st.group_id and subject_id is not distinct from p_subject;
    if v_prev is null then
        insert into attendance (tenant_id, group_id, student_id, date, status, subject_id)
        values (v_tenant, st.group_id, st.id, v_date, v_status, p_subject)
        on conflict (student_id, date, group_id, subject_id) do nothing;
        v_new := true;
    elsif v_prev = 'ABSENT' then
        update attendance set status = v_status
         where student_id = st.id and date = v_date and group_id = st.group_id and subject_id is not distinct from p_subject;
        v_new := true;
    end if;
    return jsonb_build_object('found', true, 'student_id', st.id, 'name', st.first_name || ' ' || st.last_name_paternal,
        'group', st.grade || '° ' || st.section, 'status', case when v_new then v_status else v_prev end, 'already', not v_new, 'photo_url', st.photo_url);
end $$;
revoke all on function public.card_check_in(text, text, uuid, uuid) from public, anon;
grant execute on function public.card_check_in(text, text, uuid, uuid) to authenticated;

-- Quien encuentra una credencial y la acerca a su celular solo ve de qué escuela es
create or replace function public.card_public(p_code text)
returns text language sql stable security definer set search_path to 'public' as $$
    select t.name::text from student_cards c join tenants t on t.id = c.tenant_id
     where c.code = private.card_code(p_code) and c.kind = 'TOKEN' limit 1;
$$;
revoke all on function public.card_public(text) from public;
grant execute on function public.card_public(text) to anon, authenticated;
