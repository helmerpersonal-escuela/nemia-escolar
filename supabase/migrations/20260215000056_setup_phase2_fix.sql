-- FIX SCRIPT: Ensure Students table has the Split Names
-- Run this to correct the schema if you got "Already Exists" errors.
-- Modified to be NON-DESTRUCTIVE and IDEMPOTENT

-- 1. Safely recreate STUDENTS table (to ensure it exists)
-- Removed DROP TABLE to prevent data loss on existing environments
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants not null,
  group_id uuid references public.groups,
  first_name text not null,
  last_name_paternal text not null,
  last_name_maternal text,
  curp text,
  gender text,
  birth_date date,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Idempotent Column Addition for Students
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'first_name') THEN
        ALTER TABLE public.students ADD COLUMN first_name text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'last_name_paternal') THEN
        ALTER TABLE public.students ADD COLUMN last_name_paternal text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'last_name_maternal') THEN
        ALTER TABLE public.students ADD COLUMN last_name_maternal text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'curp') THEN
        ALTER TABLE public.students ADD COLUMN curp text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'gender') THEN
        ALTER TABLE public.students ADD COLUMN gender text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'birth_date') THEN
        ALTER TABLE public.students ADD COLUMN birth_date date;
    END IF;
END $$;

-- 2. Enable RLS for Students
alter table public.students enable row level security;

-- 3. RLS Policies for Students
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

-- 4. Create other tables ONLY if they don't exist
create table if not exists public.academic_years (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants not null,
  name text not null,
  start_date date not null,
  end_date date not null,
  is_active boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants not null,
  academic_year_id uuid references public.academic_years,
  grade text not null,
  section text not null,
  shift text check (shift in ('MORNING', 'AFTERNOON', 'FULL_TIME')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.lesson_plans (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid references public.profiles not null,
  tenant_id uuid references public.tenants not null,
  group_id uuid references public.groups,
  subject text not null,
  topic text not null,
  content jsonb,
  status text default 'DRAFT',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
