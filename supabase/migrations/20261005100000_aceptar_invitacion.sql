-- Invitaciones para personas que YA tienen cuenta (o que abren el enlace con la sesión iniciada).
-- Antes /register?token=… redirigía a "/" si había sesión, así que la invitación nunca se aceptaba
-- y quien abría el enlace veía su propio panel.

-- Vista previa pública de la invitación (el token es el secreto).
create or replace function public.invitation_preview(p_token uuid)
returns table(tenant_name text, role text, email text, status text)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
    return query
    select t.name::text, upper(i.role)::text, i.email::text,
           case when i.status <> 'PENDING' then upper(i.status)::text
                when i.expires_at <= now() then 'EXPIRED'
                else 'PENDING' end
      from staff_invitations i
      join tenants t on t.id = i.tenant_id
     where i.token = p_token;
end;
$$;
grant execute on function public.invitation_preview(uuid) to anon, authenticated;

-- Aceptar con la cuenta actual: agrega el espacio con el rol invitado y lo deja como espacio activo.
create or replace function public.accept_invitation(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
    v_uid uuid := auth.uid();
    v_email text;
    inv record;
    p record;
begin
    if v_uid is null then
        raise exception 'Inicia sesión para aceptar la invitación' using errcode = '42501';
    end if;
    select email into v_email from auth.users where id = v_uid;

    select * into inv from staff_invitations where token = p_token for update;
    if not found then
        raise exception 'La invitación no existe';
    end if;
    if inv.status <> 'PENDING' then
        raise exception 'Esta invitación ya se usó';
    end if;
    if inv.expires_at <= now() then
        raise exception 'La invitación venció; pide a la escuela que te envíe una nueva';
    end if;
    if lower(inv.email) <> lower(v_email) then
        raise exception 'Esta invitación es para otro correo';
    end if;
    if upper(inv.role) not in ('DIRECTOR', 'ADMIN', 'ACADEMIC_COORD', 'TECH_COORD', 'SCHOOL_CONTROL',
                               'TEACHER', 'PREFECT', 'SUPPORT', 'TUTOR', 'STUDENT') then
        raise exception 'Rol no permitido en la invitación';
    end if;

    select first_name, last_name_paternal, last_name_maternal into p from profiles where id = v_uid;

    insert into profile_tenants (profile_id, tenant_id, role, is_default, first_name, last_name_paternal, last_name_maternal)
    values (v_uid, inv.tenant_id, upper(inv.role), false, p.first_name, p.last_name_paternal, p.last_name_maternal)
    on conflict do nothing;

    update staff_invitations set status = 'ACCEPTED' where id = inv.id;

    -- Deja la escuela invitada como espacio activo
    update profiles set tenant_id = inv.tenant_id, role = upper(inv.role) where id = v_uid;

    return inv.tenant_id;
end;
$$;
revoke all on function public.accept_invitation(uuid) from public, anon;
grant execute on function public.accept_invitation(uuid) to authenticated;
