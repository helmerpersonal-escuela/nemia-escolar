-- Seguridad: varias políticas permitían a CUALQUIER usuario autenticado leer/escribir datos de
-- otras escuelas (calificaciones, asistencia, actividades) o ver todos los espacios.
-- Se limitan al espacio (tenant) al que pertenece el usuario.

-- Asistencia y calificaciones
drop policy if exists "Enable all for attendance" on public.attendance;
create policy "Members manage attendance" on public.attendance for all to authenticated
  using (public.is_tenant_member(tenant_id)) with check (public.is_tenant_member(tenant_id));

drop policy if exists "Enable all for grades" on public.grades;
create policy "Members manage grades" on public.grades for all to authenticated
  using (public.is_tenant_member(tenant_id)) with check (public.is_tenant_member(tenant_id));

-- Actividades (assignments)
drop policy if exists "Enable insert for authenticated users only" on public.assignments;
drop policy if exists "Enable update for owners" on public.assignments;
drop policy if exists "Enable delete for owners" on public.assignments;
create policy "Members insert assignments" on public.assignments for insert to authenticated with check (public.is_tenant_member(tenant_id));
create policy "Members update assignments" on public.assignments for update to authenticated using (public.is_tenant_member(tenant_id)) with check (public.is_tenant_member(tenant_id));
create policy "Members delete assignments" on public.assignments for delete to authenticated using (public.is_tenant_member(tenant_id));

-- Inserciones que no validaban el espacio
drop policy if exists "Enable insert for authenticated users only" on public.calendar_events;
create policy "Members insert calendar events" on public.calendar_events for insert to authenticated with check (public.is_tenant_member(tenant_id));

drop policy if exists "Authenticated users can insert student alerts" on public.student_alerts;
create policy "Members insert student alerts" on public.student_alerts for insert to authenticated with check (public.is_tenant_member(tenant_id));

drop policy if exists "Users can log incidents" on public.student_incidents;
create policy "Members log incidents" on public.student_incidents for insert to authenticated with check (public.is_tenant_member(tenant_id));

-- Espacios: ya no son públicos; se crean solo con las funciones de registro (SECURITY DEFINER)
drop policy if exists "Public can view tenants" on public.tenants;
drop policy if exists "Enable insert for authenticated users" on public.tenants;
