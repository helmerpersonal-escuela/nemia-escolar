-- Catálogo pedagógico: PDAs oficiales (extraídos de los Programas Sintéticos de la SEP),
-- ejes articuladores y metodologías propias del docente o de la comunidad escolar,
-- y elementos oficiales que cada docente decide ocultar.

create table if not exists public.official_pdas (
  id uuid primary key default gen_random_uuid(),
  phase int not null,
  educational_level text,
  field_of_study text not null,
  subject_name text,
  content text not null,
  grade int,
  pda text not null,
  source text default 'programa_sintetico_2024',
  created_at timestamptz not null default now()
);
create unique index if not exists official_pdas_uniq on public.official_pdas
  (phase, field_of_study, coalesce(subject_name, ''), md5(content), coalesce(grade, 0), md5(pda));
create index if not exists official_pdas_lookup on public.official_pdas (phase, field_of_study, grade);
alter table public.official_pdas enable row level security;
drop policy if exists "Authenticated read official pdas" on public.official_pdas;
create policy "Authenticated read official pdas" on public.official_pdas for select to authenticated using (true);
drop policy if exists "God mode manages official pdas" on public.official_pdas;
create policy "God mode manages official pdas" on public.official_pdas for all to authenticated using (public.is_god_mode()) with check (public.is_god_mode());

-- Ejes articuladores y metodologías creados por el docente (PERSONAL) o para toda la escuela (SCHOOL)
create table if not exists public.pedagogy_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('EJE', 'METODOLOGIA')),
  scope text not null default 'PERSONAL' check (scope in ('PERSONAL', 'SCHOOL')),
  name text not null check (length(trim(name)) between 2 and 160),
  description text,
  field_of_study text,
  phases jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pedagogy_items_tenant on public.pedagogy_items (tenant_id, kind);
alter table public.pedagogy_items enable row level security;
drop policy if exists "Read own or school pedagogy items" on public.pedagogy_items;
create policy "Read own or school pedagogy items" on public.pedagogy_items for select to authenticated
  using (public.is_tenant_member(tenant_id) and (scope = 'SCHOOL' or created_by = auth.uid()));
drop policy if exists "Create pedagogy items" on public.pedagogy_items;
create policy "Create pedagogy items" on public.pedagogy_items for insert to authenticated
  with check (public.is_tenant_member(tenant_id) and created_by = auth.uid());
drop policy if exists "Edit own pedagogy items" on public.pedagogy_items;
create policy "Edit own pedagogy items" on public.pedagogy_items for update to authenticated
  using (created_by = auth.uid() or (scope = 'SCHOOL' and public.my_role_in_tenant(tenant_id) in ('DIRECTOR', 'ADMIN', 'ACADEMIC_COORD', 'TECH_COORD')))
  with check (public.is_tenant_member(tenant_id));
drop policy if exists "Delete own pedagogy items" on public.pedagogy_items;
create policy "Delete own pedagogy items" on public.pedagogy_items for delete to authenticated
  using (created_by = auth.uid() or (scope = 'SCHOOL' and public.my_role_in_tenant(tenant_id) in ('DIRECTOR', 'ADMIN', 'ACADEMIC_COORD', 'TECH_COORD')));

-- Elementos oficiales que el docente quitó de sus listas (se pueden restaurar)
create table if not exists public.hidden_catalog_items (
  profile_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('PDA', 'EJE', 'METODOLOGIA')),
  ref text not null,
  created_at timestamptz not null default now(),
  primary key (profile_id, kind, ref)
);
alter table public.hidden_catalog_items enable row level security;
drop policy if exists "Own hidden items" on public.hidden_catalog_items;
create policy "Own hidden items" on public.hidden_catalog_items for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
