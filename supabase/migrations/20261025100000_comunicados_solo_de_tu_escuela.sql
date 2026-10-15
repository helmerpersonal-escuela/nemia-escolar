-- Comunicados: cada quien lee solo los de su escuela.
-- La política anterior revisaba el rol del usuario pero no la escuela, así que
-- (pidiéndolo directo a la API) se podían leer comunicados de otros planteles.
drop policy if exists "Users view relevant announcements" on public.school_announcements;

create policy "Users view relevant announcements" on public.school_announcements
for select to authenticated
using (
  public.is_god_mode()
  or exists (
    select 1
    from (
      select public.my_role_in_tenant(school_announcements.tenant_id) as r
      union all
      select upper(p.role) from public.profiles p
       where p.id = (select auth.uid()) and p.tenant_id = school_announcements.tenant_id
    ) roles
    where roles.r is not null
      and (
        coalesce(cardinality(school_announcements.target_roles), 0) = 0
        or roles.r = any (school_announcements.target_roles)
        or roles.r in ('DIRECTOR', 'ADMIN')
      )
  )
);
