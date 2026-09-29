-- Encargo de cada persona del personal: cargo (p. ej. "Encargado(a) de primeros", "Contralor(a)",
-- "Secretario(a) de dirección"), grados a su cargo y actividades que le asigna la dirección.

alter table public.profile_tenants
    add column if not exists job_title text,
    add column if not exists assigned_grades smallint[] not null default '{}',
    add column if not exists duties text;

alter table public.staff_invitations
    add column if not exists job_title text,
    add column if not exists assigned_grades smallint[] not null default '{}',
    add column if not exists duties text;

-- Al unirse con una invitación, hereda el encargo que definió la dirección.
create or replace function private.copy_invitation_assignment()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare inv record;
begin
    if new.job_title is not null or coalesce(array_length(new.assigned_grades, 1), 0) > 0 or new.duties is not null then
        return new;
    end if;
    select i.job_title, i.assigned_grades, i.duties into inv
      from staff_invitations i
      join auth.users u on lower(u.email) = lower(i.email)
     where u.id = new.profile_id and i.tenant_id = new.tenant_id and i.status in ('PENDING', 'ACCEPTED')
     order by i.created_at desc limit 1;
    if found then
        new.job_title := inv.job_title;
        new.assigned_grades := coalesce(inv.assigned_grades, '{}');
        new.duties := inv.duties;
    end if;
    return new;
end;
$$;
drop trigger if exists profile_tenants_copy_assignment on public.profile_tenants;
create trigger profile_tenants_copy_assignment before insert on public.profile_tenants
    for each row execute function private.copy_invitation_assignment();

-- Lista del personal con su encargo
drop function if exists public.school_staff();
create or replace function public.school_staff()
returns table(profile_id uuid, first_name text, last_name_paternal text, last_name_maternal text,
              avatar_url text, email text, role text, is_me boolean,
              job_title text, assigned_grades smallint[], duties text)
language sql
stable
security definer
set search_path to 'public'
as $$
    select pt.profile_id,
           coalesce(pt.first_name, p.first_name)::text,
           coalesce(pt.last_name_paternal, p.last_name_paternal)::text,
           coalesce(pt.last_name_maternal, p.last_name_maternal)::text,
           coalesce(pt.avatar_url, p.avatar_url)::text,
           u.email::text,
           upper(pt.role)::text,
           pt.profile_id = auth.uid(),
           pt.job_title, pt.assigned_grades, pt.duties
      from profile_tenants pt
      join profiles p on p.id = pt.profile_id
      left join auth.users u on u.id = pt.profile_id
     where pt.tenant_id = public.get_current_tenant_id()
       and p.deleted_at is null
       and upper(pt.role) not in ('STUDENT', 'TUTOR')
       and exists (select 1 from profile_tenants me where me.profile_id = auth.uid() and me.tenant_id = pt.tenant_id)
     order by 2, 3;
$$;
grant execute on function public.school_staff() to authenticated;

-- La dirección define o cambia el encargo
create or replace function public.set_staff_assignment(p_profile_id uuid, p_job_title text, p_grades smallint[], p_duties text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_tenant uuid := private.assert_school_admin();
begin
    if exists (select 1 from unnest(coalesce(p_grades, '{}')) g where g < 1 or g > 6) then
        raise exception 'Grado no válido';
    end if;
    update profile_tenants
       set job_title = nullif(trim(coalesce(p_job_title, '')), ''),
           assigned_grades = coalesce((select array_agg(distinct g order by g) from unnest(coalesce(p_grades, '{}')) g), '{}'),
           duties = nullif(trim(coalesce(p_duties, '')), '')
     where profile_id = p_profile_id and tenant_id = v_tenant;
    if not found then
        raise exception 'Esa persona no pertenece a la escuela';
    end if;
end;
$$;
grant execute on function public.set_staff_assignment(uuid, text, smallint[], text) to authenticated;

-- Mi encargo en la escuela activa
create or replace function public.my_assignment()
returns table(role text, job_title text, assigned_grades smallint[], duties text)
language sql
stable
security definer
set search_path to 'public'
as $$
    select upper(pt.role)::text, pt.job_title, pt.assigned_grades, pt.duties
      from profile_tenants pt
     where pt.profile_id = auth.uid() and pt.tenant_id = public.get_current_tenant_id()
     limit 1;
$$;
grant execute on function public.my_assignment() to authenticated;
