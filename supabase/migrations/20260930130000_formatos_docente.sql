-- Formatos de la escuela o del docente (planeación, instrumentos, reportes...). El sistema los
-- analiza con IA (estructura: encabezado, secciones, columnas, firmas) y genera los resultados
-- con ese mismo formato. También puede proponer uno según los lineamientos de la SEP.
create table if not exists public.teacher_formats (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('PLANEACION', 'INSTRUMENTO', 'REPORTE', 'OTRO')),
  scope text not null default 'PERSONAL' check (scope in ('PERSONAL', 'SCHOOL')),
  source text not null default 'UPLOAD' check (source in ('UPLOAD', 'AI')),
  name text not null,
  file_path text,
  file_name text,
  spec jsonb not null default '{}'::jsonb,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists teacher_formats_tenant on public.teacher_formats (tenant_id, kind);
alter table public.teacher_formats enable row level security;
drop policy if exists "Read own or school formats" on public.teacher_formats;
create policy "Read own or school formats" on public.teacher_formats for select to authenticated
  using (public.is_tenant_member(tenant_id) and (scope = 'SCHOOL' or created_by = auth.uid()));
drop policy if exists "Create formats" on public.teacher_formats;
create policy "Create formats" on public.teacher_formats for insert to authenticated
  with check (public.is_tenant_member(tenant_id) and created_by = auth.uid());
drop policy if exists "Edit own formats" on public.teacher_formats;
create policy "Edit own formats" on public.teacher_formats for update to authenticated
  using (created_by = auth.uid() or (scope = 'SCHOOL' and public.my_role_in_tenant(tenant_id) in ('DIRECTOR', 'ADMIN', 'ACADEMIC_COORD', 'TECH_COORD')))
  with check (public.is_tenant_member(tenant_id));
drop policy if exists "Delete own formats" on public.teacher_formats;
create policy "Delete own formats" on public.teacher_formats for delete to authenticated
  using (created_by = auth.uid() or (scope = 'SCHOOL' and public.my_role_in_tenant(tenant_id) in ('DIRECTOR', 'ADMIN', 'ACADEMIC_COORD', 'TECH_COORD')));

-- Archivo original (privado): <tenant_id>/<user_id>/<archivo>
insert into storage.buckets (id, name, public, file_size_limit)
values ('teacher_formats', 'teacher_formats', false, 10485760)
on conflict (id) do nothing;
drop policy if exists "Formats: members read" on storage.objects;
create policy "Formats: members read" on storage.objects for select to authenticated
  using (bucket_id = 'teacher_formats' and public.is_tenant_member(public.try_uuid((storage.foldername(name))[1])));
drop policy if exists "Formats: owner write" on storage.objects;
create policy "Formats: owner write" on storage.objects for insert to authenticated
  with check (bucket_id = 'teacher_formats' and public.is_tenant_member(public.try_uuid((storage.foldername(name))[1])) and (storage.foldername(name))[2] = auth.uid()::text);
drop policy if exists "Formats: owner delete" on storage.objects;
create policy "Formats: owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'teacher_formats' and (storage.foldername(name))[2] = auth.uid()::text);
