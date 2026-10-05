-- ACCESO DE FAMILIAS: un tutor TITULAR por alumno y hasta 2 cuentas ADICIONALES autorizadas por la escuela.
-- - El código + CURP liga solo al titular; con titular activo, el código ya no sirve para otra cuenta.
-- - El titular solicita cuentas adicionales; la escuela aprueba y genera un código de un solo uso (7 días).
-- - Quien usa una cuenta adicional registra sus datos básicos (nombre, parentesco, teléfono).
-- - La escuela (y el titular, para las adicionales) puede retirar un acceso en cualquier momento.

alter table public.guardians
    add column if not exists access_role text check (access_role in ('TITULAR', 'EXTRA')),
    add column if not exists access_status text not null default 'ACTIVE' check (access_status in ('ACTIVE', 'REVOKED')),
    add column if not exists linked_at timestamptz,
    add column if not exists authorized_request uuid,
    add column if not exists revoked_at timestamptz,
    add column if not exists revoked_by uuid;

-- Cuentas que ya estaban ligadas: la más antigua de cada alumno queda como titular; las demás, adicionales
update public.guardians g set access_role = case when g.id = f.first_id then 'TITULAR' else 'EXTRA' end, linked_at = coalesce(g.linked_at, g.created_at)
  from (select distinct on (student_id) student_id, id as first_id from public.guardians where user_id is not null order by student_id, created_at) f
 where g.student_id = f.student_id and g.user_id is not null and g.access_role is null;

create table if not exists public.family_access_requests (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    student_id uuid not null references public.students(id) on delete cascade,
    requested_by uuid not null references public.profiles(id) on delete cascade,
    full_name text not null,
    relationship text not null,
    phone text,
    reason text,
    status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED', 'USED', 'CANCELLED')),
    code text unique,
    code_expires_at timestamptz,
    response text,
    decided_by uuid references public.profiles(id) on delete set null,
    decided_at timestamptz,
    used_by uuid references public.profiles(id) on delete set null,
    used_at timestamptz,
    created_at timestamptz not null default now()
);
create index if not exists idx_family_access_requests_tenant on public.family_access_requests(tenant_id, status);
alter table public.family_access_requests enable row level security;
create policy "Titular y escuela ven las solicitudes" on public.family_access_requests for select to authenticated
    using (requested_by = auth.uid() or public.is_god_mode()
           or public.my_role_in_tenant(tenant_id) in ('DIRECTOR', 'ADMIN', 'SCHOOL_CONTROL', 'SYSTEM_ADMIN', 'ACADEMIC_COORD'));
-- Sin políticas de escritura: todo pasa por las funciones de abajo.

create or replace function private.family_manager(p_tenant uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
    select public.is_god_mode() or exists (select 1 from profile_tenants where profile_id = auth.uid() and tenant_id = p_tenant
             and upper(role) in ('DIRECTOR', 'ADMIN', 'SCHOOL_CONTROL', 'SYSTEM_ADMIN', 'ACADEMIC_COORD'));
$$;

-- CANDADO: una familia no puede ligarse sola a un alumno ni cambiar a qué alumno o cuenta apunta su registro.
-- (Antes, las reglas de la tabla permitían a un tutor insertar o modificar su propio registro.)
create or replace function private.guardians_guard()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
    if auth.uid() is null or coalesce(current_setting('vunlek.family_rpc', true), '') = '1'
       or public.is_god_mode() or public.is_staff_of(auth.uid(), new.tenant_id) then
        return new;
    end if;
    if tg_op = 'INSERT' then
        raise exception 'Para ligar a un alumno usa el código y la CURP que entrega la escuela' using errcode = '42501';
    end if;
    if new.student_id is distinct from old.student_id or new.tenant_id is distinct from old.tenant_id
       or new.user_id is distinct from old.user_id or new.profile_id is distinct from old.profile_id
       or new.access_role is distinct from old.access_role or new.access_status is distinct from old.access_status
       or new.authorized_request is distinct from old.authorized_request or new.linked_at is distinct from old.linked_at then
        raise exception 'Ese dato solo lo cambia la escuela' using errcode = '42501';
    end if;
    return new;
end $$;
create or replace trigger tr_guardians_guard before insert or update on public.guardians
for each row execute function private.guardians_guard();

-- Ligar con código + CURP: solo si el alumno aún no tiene titular; quien liga queda como TITULAR
create or replace function public.redeem_family_access(p_code text, p_curp text, p_first_name text default null, p_last_name_paternal text default null, p_last_name_maternal text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
    v_uid uuid := auth.uid();
    v_clean text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
    v_curp text := upper(regexp_replace(coalesce(p_curp, ''), '[^A-Za-z0-9]', '', 'g'));
    st record; res jsonb;
    v_bad constant text := 'El código y la CURP no corresponden al mismo alumno. Revisa los dos; si sigue igual, acude a control escolar.';
begin
    if v_uid is null then raise exception 'Inicia sesión para usar el código' using errcode = '42501'; end if;
    if (select count(*) from private.family_code_attempts
         where profile_id = v_uid and not ok and created_at > now() - interval '1 hour') >= 10 then
        raise exception 'Demasiados intentos incorrectos. Espera una hora o pide ayuda a control escolar.';
    end if;
    if v_curp !~ '^[A-Z]{4}[0-9]{6}[HMX][A-Z]{5}[A-Z0-9][0-9]$' then
        return jsonb_build_object('error', 'La CURP tiene 18 letras y números. Cópiala tal como viene en el acta de nacimiento o la constancia.');
    end if;
    perform set_config('vunlek.family_rpc', '1', true);
    if length(v_clean) <> 8 then return public.redeem_family_code(p_code, p_first_name, p_last_name_paternal, p_last_name_maternal); end if;
    select s.id, s.curp, s.first_name, s.last_name_paternal into st
      from public.students s where s.family_code = substr(v_clean, 1, 4) || '-' || substr(v_clean, 5, 4);
    if st.id is null then return public.redeem_family_code(p_code, p_first_name, p_last_name_paternal, p_last_name_maternal); end if;

    if nullif(trim(coalesce(st.curp, '')), '') is not null then
        if upper(regexp_replace(st.curp, '[^A-Za-z0-9]', '', 'g')) <> v_curp then
            insert into private.family_code_attempts (profile_id, ok) values (v_uid, false);
            return jsonb_build_object('error', v_bad);
        end if;
    else
        if not private.curp_matches_name(v_curp, st.first_name, st.last_name_paternal) then
            insert into private.family_code_attempts (profile_id, ok) values (v_uid, false);
            return jsonb_build_object('error', v_bad);
        end if;
    end if;

    -- Un solo titular por alumno
    if exists (select 1 from guardians where student_id = st.id and user_id is not null and user_id <> v_uid
                 and access_status = 'ACTIVE' and coalesce(access_role, 'TITULAR') = 'TITULAR') then
        return jsonb_build_object('error', 'Este alumno ya tiene registrado a su tutor titular. Si necesitas entrar, pídele al tutor que solicite a la escuela una cuenta adicional para ti.');
    end if;

    if nullif(trim(coalesce(st.curp, '')), '') is null then
        update public.students set curp = v_curp where id = st.id;
    end if;
    res := public.redeem_family_code(p_code, p_first_name, p_last_name_paternal, p_last_name_maternal);
    if res ? 'error' then return res; end if;
    update guardians set access_role = coalesce(access_role, 'TITULAR'), access_status = 'ACTIVE', linked_at = coalesce(linked_at, now())
     where student_id = st.id and user_id = v_uid;
    return res || jsonb_build_object('role', 'TITULAR');
end $$;

-- El titular pide una cuenta adicional para alguien de su confianza (máximo 2 por alumno)
create or replace function public.request_extra_access(p_student uuid, p_full_name text, p_relationship text, p_phone text default null, p_reason text default null)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); v_tenant uuid; v_id uuid; v_name text;
begin
    select g.tenant_id into v_tenant from guardians g
     where g.student_id = p_student and g.user_id = v_uid and g.access_status = 'ACTIVE' and g.access_role = 'TITULAR';
    if v_tenant is null then raise exception 'Solo el tutor titular puede solicitar cuentas adicionales' using errcode = '42501'; end if;
    if length(trim(coalesce(p_full_name, ''))) < 5 or length(trim(coalesce(p_relationship, ''))) < 3 then
        raise exception 'Escribe el nombre completo y el parentesco de la persona';
    end if;
    if (select count(*) from guardians where student_id = p_student and user_id is not null and access_status = 'ACTIVE' and access_role = 'EXTRA')
     + (select count(*) from family_access_requests where student_id = p_student and status in ('PENDING', 'APPROVED')) >= 2 then
        raise exception 'Cada alumno puede tener como máximo 2 cuentas adicionales (contando las solicitudes en trámite)';
    end if;
    insert into family_access_requests (tenant_id, student_id, requested_by, full_name, relationship, phone, reason)
    values (v_tenant, p_student, v_uid, upper(trim(p_full_name)), upper(trim(p_relationship)),
            nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), ''), nullif(trim(coalesce(p_reason, '')), ''))
    returning id into v_id;
    select initcap(first_name) || ' ' || initcap(last_name_paternal) into v_name from students where id = p_student;
    insert into support_requests (tenant_id, created_by, kind, title, details)
    values (v_tenant, v_uid, 'FAMILIAS', 'Solicitud de cuenta adicional de una familia',
            'El tutor titular de ' || v_name || ' pide una cuenta adicional. Revísala en Códigos para familias → Cuentas con acceso.');
    return v_id;
end $$;

-- La escuela aprueba (genera un código de un solo uso, válido 7 días) o rechaza
create or replace function public.decide_extra_access(p_request uuid, p_approve boolean, p_response text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare r record; v_code text;
begin
    select * into r from family_access_requests where id = p_request for update;
    if not found then raise exception 'La solicitud no existe'; end if;
    if not private.family_manager(r.tenant_id) then raise exception 'Sin permiso' using errcode = '42501'; end if;
    if r.status <> 'PENDING' then raise exception 'Esa solicitud ya se atendió'; end if;
    if p_approve then
        v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));
        update family_access_requests set status = 'APPROVED', code = v_code, code_expires_at = now() + interval '7 days',
               decided_by = auth.uid(), decided_at = now(), response = nullif(trim(coalesce(p_response, '')), '') where id = p_request;
    else
        update family_access_requests set status = 'REJECTED', decided_by = auth.uid(), decided_at = now(),
               response = nullif(trim(coalesce(p_response, '')), '') where id = p_request;
    end if;
    return jsonb_build_object('status', case when p_approve then 'APPROVED' else 'REJECTED' end, 'code', v_code);
end $$;

-- El titular cancela su solicitud (también si ya estaba aprobada y el código no se ha usado)
create or replace function public.cancel_extra_access(p_request uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
    update family_access_requests set status = 'CANCELLED', code = null
     where id = p_request and status in ('PENDING', 'APPROVED')
       and (requested_by = auth.uid() or private.family_manager(tenant_id));
    if not found then raise exception 'No se puede cancelar esa solicitud'; end if;
end $$;

-- La persona autorizada usa su código y registra sus datos básicos
create or replace function public.redeem_extra_access(p_code text, p_first_name text, p_last_name_paternal text, p_last_name_maternal text, p_relationship text, p_phone text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
    v_uid uuid := auth.uid(); r record; v_email text; v_has boolean;
    v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
    v_first text := upper(nullif(trim(coalesce(p_first_name, '')), ''));
    v_pat text := upper(nullif(trim(coalesce(p_last_name_paternal, '')), ''));
    v_mat text := upper(nullif(trim(coalesce(p_last_name_maternal, '')), ''));
    v_rel text := upper(nullif(trim(coalesce(p_relationship, '')), ''));
    v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
    v_student text; v_school text;
begin
    if v_uid is null then raise exception 'Inicia sesión para usar el código' using errcode = '42501'; end if;
    if (select count(*) from private.family_code_attempts
         where profile_id = v_uid and not ok and created_at > now() - interval '1 hour') >= 10 then
        raise exception 'Demasiados intentos incorrectos. Espera una hora.';
    end if;
    if v_first is null or v_pat is null or v_rel is null then
        return jsonb_build_object('error', 'Escribe tu nombre, tu primer apellido y tu parentesco con el alumno.');
    end if;
    if length(v_phone) <> 10 then return jsonb_build_object('error', 'Escribe tu teléfono a 10 dígitos.'); end if;
    if length(v_code) <> 8 then return jsonb_build_object('error', 'El código tiene 8 letras y números.'); end if;
    v_code := substr(v_code, 1, 4) || '-' || substr(v_code, 5, 4);

    select * into r from family_access_requests where code = v_code and status = 'APPROVED' for update;
    if not found or r.code_expires_at <= now() then
        insert into private.family_code_attempts (profile_id, ok) values (v_uid, false);
        return jsonb_build_object('error', 'Ese código no existe, ya se usó o venció. Pide al tutor titular que solicite uno nuevo.');
    end if;
    if r.requested_by = v_uid or exists (select 1 from guardians where student_id = r.student_id and user_id = v_uid and access_status = 'ACTIVE') then
        return jsonb_build_object('error', 'Esta cuenta ya tiene acceso a ese alumno. El código es para otra persona.');
    end if;
    if (select count(*) from guardians where student_id = r.student_id and user_id is not null and access_status = 'ACTIVE' and access_role = 'EXTRA') >= 2 then
        return jsonb_build_object('error', 'Ese alumno ya tiene sus 2 cuentas adicionales.');
    end if;

    perform set_config('vunlek.family_rpc', '1', true);
    select email into v_email from auth.users where id = v_uid;
    v_has := exists (select 1 from profile_tenants where profile_id = v_uid);
    if not v_has then
        update profiles set role = 'TUTOR', tenant_id = r.tenant_id, first_name = v_first, last_name_paternal = v_pat, last_name_maternal = v_mat where id = v_uid;
    end if;
    insert into profile_tenants (profile_id, tenant_id, role, is_default, first_name, last_name_paternal, last_name_maternal)
    values (v_uid, r.tenant_id, 'TUTOR', not v_has, v_first, v_pat, v_mat)
    on conflict do nothing;
    insert into guardians (tenant_id, student_id, first_name, last_name_paternal, last_name_maternal, relationship, email, phone,
                           user_id, profile_id, access_role, access_status, linked_at, authorized_request, phones_confirmed_at)
    values (r.tenant_id, r.student_id, v_first, v_pat, v_mat, v_rel, v_email, v_phone, v_uid, v_uid, 'EXTRA', 'ACTIVE', now(), r.id, now());
    update family_access_requests set status = 'USED', used_by = v_uid, used_at = now(), code = null where id = r.id;
    insert into private.family_code_attempts (profile_id, ok) values (v_uid, true);
    select first_name into v_student from students where id = r.student_id;
    select name into v_school from tenants where id = r.tenant_id;
    return jsonb_build_object('student', v_student, 'school', v_school, 'role', 'EXTRA');
end $$;

-- Retirar un acceso: la escuela cualquiera; el titular, las cuentas adicionales de su hijo
create or replace function public.revoke_family_access(p_guardian uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare g record;
begin
    select * into g from guardians where id = p_guardian;
    if not found or g.user_id is null then raise exception 'Esa cuenta no tiene acceso activo'; end if;
    if not (private.family_manager(g.tenant_id)
            or (g.access_role = 'EXTRA' and exists (select 1 from guardians t where t.student_id = g.student_id and t.user_id = auth.uid()
                                                      and t.access_status = 'ACTIVE' and t.access_role = 'TITULAR'))) then
        raise exception 'Sin permiso' using errcode = '42501';
    end if;
    perform set_config('vunlek.family_rpc', '1', true);
    update guardians set user_id = null, profile_id = null, access_status = 'REVOKED', revoked_at = now(), revoked_by = auth.uid()
     where id = p_guardian;
end $$;

-- Quién tiene acceso. Para la escuela: de un alumno. Para la familia: de sus propios hijos (el titular ve también las adicionales y sus solicitudes).
create or replace function public.family_access_overview(p_student uuid default null)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); v_tenant uuid; v_staff boolean := false;
begin
    if p_student is not null then
        select tenant_id into v_tenant from students where id = p_student;
        v_staff := v_tenant is not null and private.family_manager(v_tenant);
    end if;
    return coalesce((
        select jsonb_agg(jsonb_build_object(
            'student_id', s.id, 'student', initcap(s.first_name) || ' ' || initcap(s.last_name_paternal),
            'my_role', me.access_role,
            'accounts', case when v_staff or me.access_role = 'TITULAR' then coalesce((
                select jsonb_agg(jsonb_build_object('id', g.id, 'name', concat_ws(' ', g.first_name, g.last_name_paternal, g.last_name_maternal),
                        'relationship', g.relationship, 'phone', g.phone, 'email', case when v_staff then g.email end,
                        'role', coalesce(g.access_role, 'TITULAR'), 'since', g.linked_at, 'is_me', g.user_id = v_uid) order by g.access_role desc, g.linked_at)
                  from guardians g where g.student_id = s.id and g.user_id is not null and g.access_status = 'ACTIVE'), '[]'::jsonb) else '[]'::jsonb end,
            'requests', case when v_staff or me.access_role = 'TITULAR' then coalesce((
                select jsonb_agg(jsonb_build_object('id', q.id, 'full_name', q.full_name, 'relationship', q.relationship, 'phone', q.phone, 'reason', q.reason,
                        'status', q.status, 'code', case when q.status = 'APPROVED' and q.code_expires_at > now() then q.code end,
                        'expires', q.code_expires_at, 'response', q.response, 'created_at', q.created_at) order by q.created_at desc)
                  from family_access_requests q where q.student_id = s.id and q.status in ('PENDING', 'APPROVED', 'REJECTED')
                   and (q.status <> 'REJECTED' or q.decided_at > now() - interval '30 days')), '[]'::jsonb) else '[]'::jsonb end))
          from students s
          left join guardians me on me.student_id = s.id and me.user_id = v_uid and me.access_status = 'ACTIVE'
         where (v_staff and s.id = p_student) or (not v_staff and me.id is not null and (p_student is null or s.id = p_student))
    ), '[]'::jsonb);
end $$;

-- Solicitudes pendientes de la escuela
create or replace function public.family_access_pending()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v_tenant uuid := public.get_current_tenant_id();
begin
    if v_tenant is null or not private.family_manager(v_tenant) then raise exception 'Sin permiso' using errcode = '42501'; end if;
    return coalesce((select jsonb_agg(jsonb_build_object('id', q.id, 'student_id', q.student_id,
            'student', initcap(s.first_name) || ' ' || initcap(s.last_name_paternal), 'group', g.grade::text || '° ' || g.section::text,
            'titular', (select concat_ws(' ', t.first_name, t.last_name_paternal) from guardians t where t.student_id = q.student_id and t.user_id = q.requested_by limit 1),
            'full_name', q.full_name, 'relationship', q.relationship, 'phone', q.phone, 'reason', q.reason, 'created_at', q.created_at) order by q.created_at)
        from family_access_requests q join students s on s.id = q.student_id left join groups g on g.id = s.group_id
       where q.tenant_id = v_tenant and q.status = 'PENDING'), '[]'::jsonb);
end $$;

revoke all on function public.request_extra_access(uuid, text, text, text, text), public.decide_extra_access(uuid, boolean, text), public.cancel_extra_access(uuid),
    public.redeem_extra_access(text, text, text, text, text, text), public.revoke_family_access(uuid), public.family_access_overview(uuid), public.family_access_pending() from public, anon;
grant execute on function public.request_extra_access(uuid, text, text, text, text), public.decide_extra_access(uuid, boolean, text), public.cancel_extra_access(uuid),
    public.redeem_extra_access(text, text, text, text, text, text), public.revoke_family_access(uuid), public.family_access_overview(uuid), public.family_access_pending() to authenticated;
