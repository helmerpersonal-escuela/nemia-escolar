-- Phase 2: Academic Core (Updated with Split Names)

-- 1. Academic Years (Ciclos Escolares)
create table if not exists public.academic_years (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants not null,
  name text not null, -- e.g. "2023-2024"
  start_date date not null,
  end_date date not null,
  is_active boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Groups (Grupos / Salones)
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants not null,
  academic_year_id uuid references public.academic_years, -- Made optional for quick start
  grade text not null, -- e.g. "1", "2", "3"
  section text not null, -- e.g. "A", "B"
  shift text check (shift in ('MORNING', 'AFTERNOON', 'FULL_TIME')), -- Turno
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Students (Alumnos) - WITH SPLIT NAMES
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants not null,
  group_id uuid references public.groups,
  first_name text not null,
  last_name_paternal text not null,
  last_name_maternal text,
  curp text, -- Mexico ID
  gender text,
  birth_date date,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Lesson Plans (Planeaciones)
create table if not exists public.lesson_plans (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid references public.profiles not null, -- Author
  tenant_id uuid references public.tenants not null,
  group_id uuid references public.groups,
  subject text not null, -- Materia
  topic text not null, -- Tema
  content jsonb, -- Flexible content for the plan (Activities, Resources, etc.)
  status text default 'DRAFT' check (status in ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.academic_years enable row level security;
alter table public.groups enable row level security;
alter table public.students enable row level security;
alter table public.lesson_plans enable row level security;

-- RLS Policies (Generic for Tenant isolation)

-- Academic Years
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'academic_years' AND policyname = 'Users can view academic_years in own tenant'
    ) THEN
        CREATE POLICY "Users can view academic_years in own tenant" ON public.academic_years for select using (tenant_id = get_current_tenant_id());
    END IF;
END $$;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'academic_years' AND policyname = 'Admins/Teachers can manage academic_years'
    ) THEN
        CREATE POLICY "Admins/Teachers can manage academic_years" ON public.academic_years for all using (tenant_id = get_current_tenant_id());
    END IF;
END $$;

-- Groups
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'groups' AND policyname = 'Users can view groups in own tenant'
    ) THEN
        CREATE POLICY "Users can view groups in own tenant" ON public.groups for select using (tenant_id = get_current_tenant_id());
    END IF;
END $$;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'groups' AND policyname = 'Admins/Teachers can manage groups'
    ) THEN
        CREATE POLICY "Admins/Teachers can manage groups" ON public.groups for all using (tenant_id = get_current_tenant_id());
    END IF;
END $$;

-- Students
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'students' AND policyname = 'Users can view students in own tenant'
    ) THEN
        CREATE POLICY "Users can view students in own tenant" ON public.students for select using (tenant_id = get_current_tenant_id());
    END IF;
END $$;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'students' AND policyname = 'Admins/Teachers can manage students'
    ) THEN
        CREATE POLICY "Admins/Teachers can manage students" ON public.students for all using (tenant_id = get_current_tenant_id());
    END IF;
END $$;

-- Lesson Plans
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'lesson_plans' AND policyname = 'Users can view plans in own tenant'
    ) THEN
        CREATE POLICY "Users can view plans in own tenant" ON public.lesson_plans for select using (tenant_id = get_current_tenant_id());
    END IF;
END $$;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'lesson_plans' AND policyname = 'Teachers can manage own plans'
    ) THEN
        CREATE POLICY "Teachers can manage own plans" ON public.lesson_plans for all using (tenant_id = get_current_tenant_id());
    END IF;
END $$;
