-- Phase 1.6: Subject Management (New Mexican School Model)

-- 1. Create Subject Catalog Table
create table if not exists public.subject_catalog (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  educational_level text not null check (educational_level in ('PRIMARY', 'SECONDARY', 'BOTH')),
  field_of_study text not null, -- 'Lenguajes', 'Saberes...', etc.
  requires_specification boolean default false, -- For 'Tecnología' or 'Lenguas Indígenas'
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add unique constraint safeley
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subject_catalog_name_level_uniq') THEN
        ALTER TABLE public.subject_catalog ADD CONSTRAINT subject_catalog_name_level_uniq UNIQUE (name, educational_level);
    END IF;
END $$;

-- 2. Create Profile Subjects Table (Teacher's selected subjects)
create table if not exists public.profile_subjects (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles not null,
  tenant_id uuid references public.tenants not null,
  subject_catalog_id uuid references public.subject_catalog not null,
  custom_detail text, -- For specific technology or language name
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(profile_id, subject_catalog_id)
);

-- 3. Enable RLS
alter table public.subject_catalog enable row level security;
alter table public.profile_subjects enable row level security;

-- 4. RLS Policies
-- Catalog: Readable by everyone (authenticated)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Everyone can read subject_catalog') THEN
    create policy "Everyone can read subject_catalog"
      on public.subject_catalog for select using (auth.role() = 'authenticated');
  END IF;
END $$;

-- Profile Subjects: Users manage their own
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users manage own subjects') THEN
    create policy "Users manage own subjects"
      on public.profile_subjects for all using (profile_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users view tenant subjects') THEN
    create policy "Users view tenant subjects"
      on public.profile_subjects for select using (tenant_id = get_current_tenant_id());
  END IF;
END $$;

-- 5. SEED DATA (NEM - Nueva Escuela Mexicana)

-- PRIMARY
insert into public.subject_catalog (name, educational_level, field_of_study, requires_specification) values
-- Lenguajes
('Español', 'PRIMARY', 'Lenguajes', false),
('Lengua Indígena', 'PRIMARY', 'Lenguajes', true),
('Inglés', 'PRIMARY', 'Lenguajes', false),
('Artes', 'PRIMARY', 'Lenguajes', false),
-- Saberes
('Matemáticas', 'PRIMARY', 'Saberes y Pensamiento Científico', false),
('Ciencias Naturales', 'PRIMARY', 'Saberes y Pensamiento Científico', false),
-- Ética
('Geografía', 'PRIMARY', 'Ética, Naturaleza y Sociedades', false),
('Historia', 'PRIMARY', 'Ética, Naturaleza y Sociedades', false),
('Formación Cívica y Ética', 'PRIMARY', 'Ética, Naturaleza y Sociedades', false),
-- De lo Humano
('Educación Física', 'PRIMARY', 'De lo Humano y lo Comunitario', false),
('Vida Saludable', 'PRIMARY', 'De lo Humano y lo Comunitario', false),
('Educación Socioemocional', 'PRIMARY', 'De lo Humano y lo Comunitario', false)
ON CONFLICT (name, educational_level) DO NOTHING;

-- SECONDARY
insert into public.subject_catalog (name, educational_level, field_of_study, requires_specification) values
-- Lenguajes
('Español', 'SECONDARY', 'Lenguajes', false),
('Inglés', 'SECONDARY', 'Lenguajes', false),
('Artes', 'SECONDARY', 'Lenguajes', false),
-- Saberes
('Matemáticas', 'SECONDARY', 'Saberes y Pensamiento Científico', false),
('Biología', 'SECONDARY', 'Saberes y Pensamiento Científico', false),
('Física', 'SECONDARY', 'Saberes y Pensamiento Científico', false),
('Química', 'SECONDARY', 'Saberes y Pensamiento Científico', false),
-- Ética
('Historia', 'SECONDARY', 'Ética, Naturaleza y Sociedades', false),
('Geografía', 'SECONDARY', 'Ética, Naturaleza y Sociedades', false),
('Formación Cívica y Ética', 'SECONDARY', 'Ética, Naturaleza y Sociedades', false),
-- De lo Humano
('Tecnología', 'SECONDARY', 'De lo Humano y lo Comunitario', true),
('Educación Física', 'SECONDARY', 'De lo Humano y lo Comunitario', false),
('Tutoría / Socioemocional', 'SECONDARY', 'De lo Humano y lo Comunitario', false),
-- Otros
('Autonomía Curricular', 'SECONDARY', 'Autonomía Curricular', false)
ON CONFLICT (name, educational_level) DO NOTHING;
