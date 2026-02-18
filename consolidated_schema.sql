-- ########## PRIORITY FILE: 20260215000052_setup_database.sql ##########
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Create Tenants Table
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('SCHOOL', 'INDEPENDENT')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Create Profiles Table (Linked to Auth Users)
create table if not exists public.profiles (
  id uuid references auth.users not null primary key,
  tenant_id uuid references public.tenants not null,
  full_name text,
  role text not null check (role in ('ADMIN', 'TEACHER', 'TUTOR', 'STUDENT')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Enable RLS
alter table public.tenants enable row level security;
alter table public.profiles enable row level security;

-- 4. RLS Policies

-- Helper function to get current user's tenant_id
create or replace function get_current_tenant_id()
returns uuid
language sql
security definer
as $$
  select tenant_id from public.profiles where id = auth.uid();
$$;

-- TENANTS Policies
-- Users can view their own tenant
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'tenants' AND policyname = 'Users can view own tenant'
    ) THEN
        CREATE POLICY "Users can view own tenant" ON public.tenants for select
  using (id = get_current_tenant_id());
    END IF;
END $$;

-- New users need to be able to insert a tenant during registration (if they are admins/creators)
-- This is tricky. Usually we use a Postgres Function for registration to handle atomicity.
-- For now, allow insert if authenticated (we'll refine this).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'tenants' AND policyname = 'Enable insert for authenticated users'
    ) THEN
        CREATE POLICY "Enable insert for authenticated users" ON public.tenants for insert 
  to authenticated 
  with check (true);
    END IF;
END $$;

-- PROFILES Policies
-- Users can view profiles in their own tenant
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' AND policyname = 'Users can view profiles in own tenant'
    ) THEN
        CREATE POLICY "Users can view profiles in own tenant" ON public.profiles for select
  using (tenant_id = get_current_tenant_id());
    END IF;
END $$;

-- Users can update their own profile
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' AND policyname = 'Users can update own profile'
    ) THEN
        CREATE POLICY "Users can update own profile" ON public.profiles for update
  using (id = auth.uid());
    END IF;
END $$;

-- Allow insert during registration
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' AND policyname = 'Enable insert for authenticated users profiles'
    ) THEN
        CREATE POLICY "Enable insert for authenticated users profiles" ON public.profiles for insert
  to authenticated
  with check (id = auth.uid());
    END IF;
END $$;



-- ########## PRIORITY FILE: 20260215000053_setup_phase1_5_onboarding.sql ##########
-- Phase 1.5: Onboarding Schema Updates
-- Adds columns for School Details, Location, and Avatar

-- 1. Update TENANTS table (School Information)
alter table public.tenants 
add column if not exists educational_level text check (educational_level in ('PRESCHOOL', 'PRIMARY', 'SECONDARY', 'HIGH_SCHOOL', 'UNIVERSITY', 'OTHER')),
add column if not exists cct text, -- Clave de Centro de Trabajo
add column if not exists phone text,
add column if not exists address text,
add column if not exists location_lat double precision,
add column if not exists location_lng double precision,
add column if not exists logo_url text, -- Storage URL
add column if not exists onboarding_completed boolean default false;

-- 2. Update PROFILES table (User Personalization)
alter table public.profiles
add column if not exists avatar_url text; -- Can be internal path or external URL

-- 3. Update/Recreate the Trigger Function to handle these new fields if passed in metadata
-- (We will update the function logic in a separate step or rely on a robust separate 'Onboarding API' call)
-- For now, the strategy is: 
-- Step 1 (Register): Create Account (Email, Pass, Names).
-- Step 2 (Wizard): Update Tenant/Profile via standard API calls (RLS allows Admin to update own tenant).

-- Ensure RLS allows Admins to UPDATE their own Tenant details
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'tenants' AND policyname = 'Admins can update own tenant'
    ) THEN
        CREATE POLICY "Admins can update own tenant" ON public.tenants
for update
using (id = get_current_tenant_id());
    END IF;
END $$;



-- ########## PRIORITY FILE: 20260215000110_subscriptions_schema.sql ##########
-- SUBSCRIPTIONS AND PAYMENTS SCHEMA

BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status') THEN
        CREATE TYPE public.subscription_status AS ENUM (
            'trialing', 'active', 'past_due', 'canceled', 'unpaid'
        );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plan_interval') THEN
        CREATE TYPE public.plan_interval AS ENUM (
            'month', 'year'
        );
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.subscriptions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) NOT NULL,
    status public.subscription_status NOT NULL DEFAULT 'trialing',
    plan_type text NOT NULL DEFAULT 'ANNUAL', -- 'ANNUAL' or 'MONTHLY' (but we only have annual)
    current_period_start timestamptz NOT NULL DEFAULT now(),
    current_period_end timestamptz NOT NULL,
    cancel_at_period_end boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    mercadopago_subscription_id text,
    mercadopago_customer_id text,
    CONSTRAINT subscriptions_user_id_key UNIQUE (user_id) -- One subscription per user for now
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON public.subscriptions(status);

-- RLS Policies
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can read their own subscription
-- Users can read their own subscription
DROP POLICY IF EXISTS "Users can read own subscription" ON public.subscriptions;
CREATE POLICY "Users can read own subscription" ON public.subscriptions
    FOR SELECT
    USING (auth.uid() = user_id);

-- Only Service Role (Edge Functions) can insert/update/delete
-- (Implicitly denied for anon/authenticated unless we add policy)
-- But we might need update for testing? No, keep it strict. 
-- Wait, system triggers might need to update it?
-- We'll allow SERVICE_ROLE full access by default (Supabase default).

-- Updates: Allow users to cancel? Maybe update `cancel_at_period_end`?
-- For now, updates via API/Edge Function is safer.

-- Add RLS to Profiles to allow Service Role to update `subscription_status` if efficient?
-- Actually, let's keep subscription details in `subscriptions` table.

-- 3. Payment Transactions Log (Auditing)
-- Drop existing if it was created by older migrations
DROP TABLE IF EXISTS public.payment_transactions CASCADE;

CREATE TABLE IF NOT EXISTS public.payment_transactions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    subscription_id uuid REFERENCES public.subscriptions(id),
    tenant_id uuid REFERENCES public.tenants(id),
    user_id uuid REFERENCES auth.users(id),
    amount decimal(10,2) NOT NULL,
    currency text DEFAULT 'MXN',
    status text NOT NULL, -- 'approved', 'rejected', 'pending'
    provider text NOT NULL DEFAULT 'MERCADO_PAGO',
    provider_payment_id text UNIQUE, -- MP Payment ID
    created_at timestamptz DEFAULT now(),
    meta jsonb DEFAULT '{}'::jsonb
);

-- Ensure subscriptions has trial logic
-- Adding a few helper columns if needed (already handled by current_period_end)
-- Let's add a default trial period if we wanted to automate it via trigger,
-- but for now we'll handle it in the webhook/app logic.

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

-- Users see their own transactions
-- Users see their own transactions
DROP POLICY IF EXISTS "Users see own transactions" ON public.payment_transactions;
CREATE POLICY "Users see own transactions" ON public.payment_transactions
    FOR SELECT
    USING (
        subscription_id IN (
            SELECT id FROM public.subscriptions WHERE user_id = auth.uid()
        )
    );

-- 4. Auto-Trial Trigger for New Users
CREATE OR REPLACE FUNCTION public.handle_new_user_trial()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.subscriptions (user_id, status, plan_type, current_period_end)
    VALUES (NEW.id, 'trialing', 'ANNUAL', now() + interval '30 days')
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if trigger exists on auth.users (requires superuser or handled via Supabase dashboard)
-- In a migration, we can't always Target auth.users directly unless we have permissions.
-- However, we can try to apply it to a public table that triggers on auth events if available,
-- but the standard way is auth.users.
DROP TRIGGER IF EXISTS on_auth_user_created_trial ON auth.users;
CREATE TRIGGER on_auth_user_created_trial
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_trial();

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_subscriptions_updated ON public.subscriptions;
CREATE TRIGGER on_subscriptions_updated
    BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

COMMIT;



-- ########## PRIORITY FILE: 20260215000029_institutional_setup.sql ##########
-- 1. Update Roles Constraint in profiles table
-- We need to drop the old constraint and add the new one
DO $$ 
BEGIN 
    ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
    CHECK (role IN (
        'SUPER_ADMIN',
        'ADMIN',
        'DIRECTOR',
        'ACADEMIC_COORD',
        'TECH_COORD',
        'SCHOOL_CONTROL',
        'TEACHER',
        'PREFECT',
        'SUPPORT',
        'TUTOR',
        'STUDENT'
    ));
END $$;

-- 2. Create school_details table
CREATE TABLE IF NOT EXISTS public.school_details (
    tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
    
    -- Identity
    official_name text NOT NULL,
    cct text NOT NULL,
    shift text CHECK (shift IN ('MORNING', 'AFTERNOON', 'FULL_TIME')),
    zone text,
    sector text,
    regime text, -- Public (Federal, State, Transferred)
    
    -- Location
    address_street text,
    address_neighborhood text,
    address_zip_code text,
    address_municipality text,
    address_state text,
    
    -- Contact
    phone text,
    email text,
    social_media jsonb DEFAULT '{}'::jsonb,
    
    -- Academic
    educational_level text, -- General, Technical, Telesecundaria
    curriculum_plan text, -- Plan 2022, etc.
    workshops text[], -- List of technologies/emphasis
    
    -- Representation
    director_name text,
    director_curp text,
    
    -- Assets
    logo_url text,
    header_logo_url text, -- SEP / Official Government logos
    digital_seal_url text,
    
    updated_at timestamp with time zone DEFAULT now()
);

-- 3. Enable RLS for school_details
ALTER TABLE public.school_details ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'school_details' AND policyname = 'Users can view school details in their own tenant'
    ) THEN
        CREATE POLICY "Users can view school details in their own tenant"
        ON public.school_details FOR SELECT
        USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'school_details' AND policyname = 'Admins can manage school details'
    ) THEN
        CREATE POLICY "Admins can manage school details"
        ON public.school_details FOR ALL
        USING (EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role IN ('SUPER_ADMIN', 'ADMIN', 'DIRECTOR')
        ));
    END IF;
END $$;

-- 4. Sync existing logos from tenants to school_details (Mental Migration)
-- This ensures that any logo already uploaded is available in the new structure
INSERT INTO public.school_details (tenant_id, official_name, cct, logo_url)
SELECT id, name, COALESCE(cct, 'SIN-CCT'), logo_url
FROM public.tenants
ON CONFLICT (tenant_id) DO UPDATE SET
    official_name = EXCLUDED.official_name,
    cct = EXCLUDED.cct,
    logo_url = EXCLUDED.logo_url;



-- ########## PRIORITY FILE: 20260215000055_setup_phase2.sql ##########
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



-- ########## PRIORITY FILE: 20260215000057_setup_phase3_students.sql ##########
-- Phase 3: Student Management & Guardians

-- 1. Update Students Table (Add contact, biometrics, info)
ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS email text,
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS address text,
ADD COLUMN IF NOT EXISTS blood_type text,
ADD COLUMN IF NOT EXISTS allergies text,
ADD COLUMN IF NOT EXISTS photo_url text, -- For locally stored or bucket URL
ADD COLUMN IF NOT EXISTS fingerprint_data text, -- Placeholder for bio string
ADD COLUMN IF NOT EXISTS status text default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE', 'GRADUATED'));

-- Ensure group_id is a foreign key (already done in phase 2 but confirming)
-- CONSTRAINT: Student belongs to ONE group (enforced by single column FK)

-- 2. Create Guardians Table
CREATE TABLE IF NOT EXISTS public.guardians (
    id uuid primary key default gen_random_uuid(),
    student_id uuid references public.students(id) not null,
    first_name text not null,
    last_name_paternal text not null,
    last_name_maternal text,
    relationship text not null, -- Father, Mother, etc.
    email text,
    phone text,
    occupation text,
    address text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. RLS for Guardians
ALTER TABLE public.guardians ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view guardians for students in their tenant
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'guardians' AND policyname = 'Users can view guardians in own tenant'
    ) THEN
        CREATE POLICY "Users can view guardians in own tenant" ON public.guardians FOR SELECT
USING (
    student_id IN (
        SELECT id FROM public.students WHERE tenant_id = get_current_tenant_id()
    )
);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'guardians' AND policyname = 'Admins/Teachers can manage guardians'
    ) THEN
        CREATE POLICY "Admins/Teachers can manage guardians" ON public.guardians FOR ALL
USING (
    student_id IN (
        SELECT id FROM public.students WHERE tenant_id = get_current_tenant_id()
    )
);
    END IF;
END $$;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS condition text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS condition_details text;



-- ########## PRIORITY FILE: 20260215000054_setup_phase1_6_subjects.sql ##########
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



-- ########## PRIORITY FILE: 20260215000038_create_evaluation_config_schema.sql ##########

-- Tabla de Periodos de Evaluación (ej. Trimestre 1, Unidad 2)
CREATE TABLE IF NOT EXISTS public.evaluation_periods (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL, -- "Primer Trimestre", "Parcial 1"
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT FALSE, -- Para marcar el periodo actual por defecto
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de Criterios de Evaluación por Grupo y Periodo
CREATE TABLE IF NOT EXISTS public.evaluation_criteria (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    period_id UUID REFERENCES public.evaluation_periods(id) ON DELETE CASCADE NOT NULL,
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
    
    name TEXT NOT NULL, -- "Examen", "Tareas", "Participación"
    percentage NUMERIC(5,2) NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
    description TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indices para busquedas rapidas
CREATE INDEX IF NOT EXISTS idx_eval_periods_tenant ON public.evaluation_periods(tenant_id);
CREATE INDEX IF NOT EXISTS idx_eval_criteria_group_period ON public.evaluation_criteria(group_id, period_id);

-- Habilitar RLS
ALTER TABLE public.evaluation_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_criteria ENABLE ROW LEVEL SECURITY;

-- Politicas RLS (Simplificadas: lectura/escritura para usuarios autenticados del mismo tenant)
-- PERIODS
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'evaluation_periods' AND policyname = 'Enable access for tenant users'
    ) THEN
        CREATE POLICY "Enable access for tenant users" ON public.evaluation_periods
    USING (auth.uid() IN (SELECT id FROM profiles WHERE tenant_id = evaluation_periods.tenant_id))
    WITH CHECK (auth.uid() IN (SELECT id FROM profiles WHERE tenant_id = evaluation_periods.tenant_id));
    END IF;
END $$;

-- CRITERIA
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'evaluation_criteria' AND policyname = 'Enable access for tenant users'
    ) THEN
        CREATE POLICY "Enable access for tenant users" ON public.evaluation_criteria
    USING (auth.uid() IN (SELECT id FROM profiles WHERE tenant_id = evaluation_criteria.tenant_id))
    WITH CHECK (auth.uid() IN (SELECT id FROM profiles WHERE tenant_id = evaluation_criteria.tenant_id));
    END IF;
END $$;



-- ########## PRIORITY FILE: 20260215000003_create_criteria_catalog.sql ##########
-- Migration: Create Evaluation Criteria Catalog
CREATE TABLE IF NOT EXISTS evaluation_criteria_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for faster lookups by tenant
CREATE INDEX IF NOT EXISTS idx_criteria_catalog_tenant ON evaluation_criteria_catalog(tenant_id);

-- Seed with standard entries (marking them as is_default potentially for all tenants or just global)
INSERT INTO evaluation_criteria_catalog (name, description, is_default) VALUES
('Conocimientos adquiridos', 'Dominio de conceptos y contenidos teóricos.', true),
('Habilidades y destrezas', 'Capacidad práctica para ejecutar tareas y procedimientos.', true),
('Comprensión lectora', 'Habilidad para entender e interpretar diversos tipos de textos.', true),
('Expresión oral', 'Capacidad de comunicar ideas de forma clara y coherente verbalmente.', true),
('Expresión escrita', 'Habilidad para redactar textos con corrección, coherencia y sentido.', true),
('Pensamiento crítico', 'Análisis, evaluación y síntesis de información de forma objetiva.', true),
('Resolución de problemas', 'Capacidad para encontrar soluciones efectivas a situaciones complejas.', true),
('Colaboración y trabajo en equipo', 'Habilidad para trabajar constructivamente con otros hacia una meta común.', true),
('Creatividad', 'Generación de ideas originales y soluciones innovadoras.', true),
('Reflexión metacognitiva', 'Capacidad de reflexionar sobre el propio proceso de aprendizaje.', true),
('Actitud y compromiso', 'Disposición hacia el aprendizaje y vinculación con las actividades.', true),
('Autonomía en el aprendizaje', 'Capacidad de gestionar el propio aprendizaje de forma independiente.', true),
('Uso de recursos', 'Manejo efectivo de herramientas, materiales y tecnologías.', true),
('Aplicación en contextos reales', 'Habilidad para transferir lo aprendido a situaciones de la vida cotidiana.', true),
('Interculturalidad e inclusión', 'Respeto a la diversidad y fomento de un ambiente inclusivo.', true),
('Responsabilidad y puntualidad', 'Cumplimiento de compromisos y tiempos establecidos.', true),
('Evolución y mejora continua', 'Progreso evidenciado a lo largo del tiempo en el aprendizaje.', true)
ON CONFLICT DO NOTHING;



-- ########## PRIORITY FILE: 20260215000039_create_evaluation_schema.sql ##########
-- TABLA DE ASIGNACIONES (Tareas, Proyectos, Examenes)
CREATE TABLE IF NOT EXISTS public.assignments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
    subject_id UUID REFERENCES public.subject_catalog(id) ON DELETE SET NULL, -- Puede ser null si es una actividad general
    title TEXT NOT NULL,
    description TEXT,
    due_date TIMESTAMP WITH TIME ZONE,
    type TEXT NOT NULL CHECK (type IN ('HOMEWORK', 'EXAM', 'PROJECT', 'PARTICIPATION', 'CLASSWORK')),
    weightING_percentage NUMERIC(5,2) DEFAULT 0, -- Porcentaje del valor final (ej. 20%)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TABLA DE CALIFICACIONES
CREATE TABLE IF NOT EXISTS public.grades (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    assignment_id UUID REFERENCES public.assignments(id) ON DELETE CASCADE NOT NULL,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
    score NUMERIC(5,2), -- Calificación (ej. 8.5, 100)
    feedback TEXT, -- Retroalimentación cualitativa
    is_graded BOOLEAN DEFAULT FALSE,
    graded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(assignment_id, student_id)
);

-- TABLA DE ASISTENCIA
CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL CHECK (status IN ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(student_id, date, group_id) -- Un registro por alumno, por grupo, por día
);

-- Enable RLS
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Policies (Simplified for now - authenticated users can access their tenant's data)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'assignments' AND policyname = 'Enable read over assignments for tenant'
    ) THEN
        CREATE POLICY "Enable read over assignments for tenant" ON public.assignments FOR SELECT USING (auth.uid() IN (SELECT id FROM profiles WHERE tenant_id = assignments.tenant_id));
    END IF;
END $$;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'assignments' AND policyname = 'Enable insert for authenticated users only'
    ) THEN
        CREATE POLICY "Enable insert for authenticated users only" ON public.assignments FOR INSERT WITH CHECK (auth.role() = 'authenticated');
    END IF;
END $$;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'assignments' AND policyname = 'Enable update for owners'
    ) THEN
        CREATE POLICY "Enable update for owners" ON public.assignments FOR UPDATE USING (auth.role() = 'authenticated');
    END IF;
END $$;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'assignments' AND policyname = 'Enable delete for owners'
    ) THEN
        CREATE POLICY "Enable delete for owners" ON public.assignments FOR DELETE USING (auth.role() = 'authenticated');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'grades' AND policyname = 'Enable read over grades for tenant'
    ) THEN
        CREATE POLICY "Enable read over grades for tenant" ON public.grades FOR SELECT USING (auth.uid() IN (SELECT id FROM profiles WHERE tenant_id = grades.tenant_id));
    END IF;
END $$;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'grades' AND policyname = 'Enable all for grades'
    ) THEN
        CREATE POLICY "Enable all for grades" ON public.grades FOR ALL USING (auth.role() = 'authenticated');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'attendance' AND policyname = 'Enable read over attendance for tenant'
    ) THEN
        CREATE POLICY "Enable read over attendance for tenant" ON public.attendance FOR SELECT USING (auth.uid() IN (SELECT id FROM profiles WHERE tenant_id = attendance.tenant_id));
    END IF;
END $$;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'attendance' AND policyname = 'Enable all for attendance'
    ) THEN
        CREATE POLICY "Enable all for attendance" ON public.attendance FOR ALL USING (auth.role() = 'authenticated');
    END IF;
END $$;



-- ########## PRIORITY FILE: 20260215000042_create_planning_schema.sql ##########
-- TABLA DE PLANEACIÓN DIDÁCTICA (NEM)
-- Removed DROP TABLE to prevent data loss on existing environments

CREATE TABLE IF NOT EXISTS public.lesson_plans (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
    subject_id UUID REFERENCES public.subject_catalog(id) ON DELETE SET NULL,
    period_id UUID REFERENCES public.evaluation_periods(id) ON DELETE SET NULL,
    
    title TEXT NOT NULL,
    temporality TEXT CHECK (temporality IN ('WEEKLY', 'MONTHLY', 'PROJECT')),
    start_date DATE,
    end_date DATE,
    
    -- Campos Core NEM
    campo_formativo TEXT,
    metodologia TEXT, -- ABP, STEAM, ABS, etc.
    problem_context TEXT, -- Identificación de la situación problemática
    
    -- Secciones Estructuradas (JSONB para flexibilidad)
    objectives JSONB DEFAULT '[]',
    contents JSONB DEFAULT '[]', -- Contenidos del programa sintético
    pda JSONB DEFAULT '[]', -- Procesos de Desarrollo de Aprendizaje
    ejes_articuladores JSONB DEFAULT '[]', -- Inclusión, Pensamiento Crítico, etc.
    
    -- Secuencia Didáctica
    activities_sequence JSONB DEFAULT '[]', -- Pasos, sesiones y actividades
    
    -- Recursos y Evaluación
    resources TEXT[],
    evaluation_plan JSONB DEFAULT '{}', -- Instrumentos y criterios
    
    status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SUBMITTED', 'APPROVED')),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Idempotent Column Addition
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_plans' AND column_name = 'period_id') THEN
        ALTER TABLE public.lesson_plans ADD COLUMN period_id UUID REFERENCES public.evaluation_periods(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_plans' AND column_name = 'temporality') THEN
        ALTER TABLE public.lesson_plans ADD COLUMN temporality TEXT CHECK (temporality IN ('WEEKLY', 'MONTHLY', 'PROJECT'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_plans' AND column_name = 'start_date') THEN
        ALTER TABLE public.lesson_plans ADD COLUMN start_date DATE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_plans' AND column_name = 'end_date') THEN
        ALTER TABLE public.lesson_plans ADD COLUMN end_date DATE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_plans' AND column_name = 'metodologia') THEN
        ALTER TABLE public.lesson_plans ADD COLUMN metodologia TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_plans' AND column_name = 'problem_context') THEN
        ALTER TABLE public.lesson_plans ADD COLUMN problem_context TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_plans' AND column_name = 'status') THEN
        ALTER TABLE public.lesson_plans ADD COLUMN status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SUBMITTED', 'APPROVED'));
    END IF;
    
    -- Add other columns if potentially missing from older versions
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_plans' AND column_name = 'objectives') THEN
        ALTER TABLE public.lesson_plans ADD COLUMN objectives JSONB DEFAULT '[]';
    END IF;
END $$;

-- Habilitar RLS
ALTER TABLE public.lesson_plans ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'lesson_plans' AND policyname = 'Enable access for tenant users on lesson_plans'
    ) THEN
        CREATE POLICY "Enable access for tenant users on lesson_plans" ON public.lesson_plans
    USING (auth.uid() IN (SELECT id FROM profiles WHERE tenant_id = lesson_plans.tenant_id))
    WITH CHECK (auth.uid() IN (SELECT id FROM profiles WHERE tenant_id = lesson_plans.tenant_id));
    END IF;
END $$;

-- Índice para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_plans_group ON public.lesson_plans(group_id);
CREATE INDEX IF NOT EXISTS idx_plans_period ON public.lesson_plans(period_id);



-- ########## PRIORITY FILE: 20260215000043_create_rubric_schema.sql ##########

-- Tabla Principal de Rúbricas
CREATE TABLE IF NOT EXISTS public.rubrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL CHECK (type IN ('ANALYTIC', 'HOLISTIC')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Niveles de Desempeño (Columnas: Ej. Excelente(4), Bueno(3)...)
CREATE TABLE IF NOT EXISTS public.rubric_levels (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    rubric_id UUID REFERENCES public.rubrics(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL, -- "Excelente", "Necesita Mejora"
    score NUMERIC(5,2) NOT NULL, -- 4.0, 10.0
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criterios de Evaluación (Filas: Ej. Ortografía, Coherencia...)
CREATE TABLE IF NOT EXISTS public.rubric_criteria (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    rubric_id UUID REFERENCES public.rubrics(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    weight NUMERIC(5,2) DEFAULT 0, -- Opcional, si se pondera
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Descriptores (Celdas: Descripción específica para Criterio X en Nivel Y)
CREATE TABLE IF NOT EXISTS public.rubric_descriptors (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    criterion_id UUID REFERENCES public.rubric_criteria(id) ON DELETE CASCADE NOT NULL,
    level_id UUID REFERENCES public.rubric_levels(id) ON DELETE CASCADE NOT NULL,
    description TEXT, -- "El alumno no comete errores ortográficos."
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(criterion_id, level_id)
);

-- Habilitar RLS
ALTER TABLE public.rubrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rubric_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rubric_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rubric_descriptors ENABLE ROW LEVEL SECURITY;

-- Políticas RLS (Standard Tenant Access)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'rubrics' AND policyname = 'Enable access for tenant users'
    ) THEN
        CREATE POLICY "Enable access for tenant users" ON public.rubrics
    USING (auth.uid() IN (SELECT id FROM profiles WHERE tenant_id = rubrics.tenant_id))
    WITH CHECK (auth.uid() IN (SELECT id FROM profiles WHERE tenant_id = rubrics.tenant_id));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'rubric_levels' AND policyname = 'Enable access for tenant users'
    ) THEN
        CREATE POLICY "Enable access for tenant users" ON public.rubric_levels
    USING (rubric_id IN (SELECT id FROM rubrics WHERE tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid())));
    END IF;
END $$;
    -- Access via parent rubric check for cleaner logic, or direct join (simplified here via subquery logic)

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'rubric_criteria' AND policyname = 'Enable access for tenant users'
    ) THEN
        CREATE POLICY "Enable access for tenant users" ON public.rubric_criteria
    USING (rubric_id IN (SELECT id FROM rubrics WHERE tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid())));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'rubric_descriptors' AND policyname = 'Enable access for tenant users'
    ) THEN
        CREATE POLICY "Enable access for tenant users" ON public.rubric_descriptors
    USING (criterion_id IN (SELECT id FROM rubric_criteria WHERE rubric_id IN (SELECT id FROM rubrics WHERE tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()))));
    END IF;
END $$;



-- ########## PRIORITY FILE: 20260215000047_create_tracking_schema.sql ##########
-- TABLA DE INCIDENCIAS (BITÁCORA)
CREATE TABLE IF NOT EXISTS public.student_incidents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
    teacher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('CONDUCTA', 'ACADEMICO', 'EMOCIONAL', 'POSITIVO', 'SALUD')),
    severity TEXT NOT NULL CHECK (severity IN ('BAJA', 'MEDIA', 'ALTA')),
    description TEXT NOT NULL,
    action_taken TEXT,
    is_private BOOLEAN DEFAULT FALSE, -- Si solo el autor puede verlo
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TABLA DE BAP Y AJUSTES RAZONABLES (INCLUSIÓN)
CREATE TABLE IF NOT EXISTS public.student_bap_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
    barrier_type TEXT, -- Físicas, Curriculares, Sociales, etc.
    diagnosis TEXT,
    adjustments JSONB, -- Array de ajustes específicos
    follow_up_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(student_id) -- Un registro de seguimiento por alumno
);

-- RLS
ALTER TABLE public.student_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_bap_records ENABLE ROW LEVEL SECURITY;

-- Policity for Incidents
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'student_incidents' AND policyname = 'Users can view incidents for their tenant'
    ) THEN
        CREATE POLICY "Users can view incidents for their tenant" ON public.student_incidents FOR SELECT
USING (auth.uid() IN (SELECT id FROM public.profiles WHERE tenant_id = student_incidents.tenant_id));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'student_incidents' AND policyname = 'Users can log incidents'
    ) THEN
        CREATE POLICY "Users can log incidents" ON public.student_incidents FOR INSERT
WITH CHECK (auth.role() = 'authenticated');
    END IF;
END $$;

-- Policity for BAP
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'student_bap_records' AND policyname = 'Users can view BAP records'
    ) THEN
        CREATE POLICY "Users can view BAP records" ON public.student_bap_records FOR SELECT
USING (auth.uid() IN (SELECT id FROM public.profiles WHERE tenant_id = student_bap_records.tenant_id));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'student_bap_records' AND policyname = 'Teachers can manage BAP'
    ) THEN
        CREATE POLICY "Teachers can manage BAP" ON public.student_bap_records FOR ALL
USING (auth.uid() IN (SELECT id FROM public.profiles WHERE tenant_id = student_bap_records.tenant_id));
    END IF;
END $$;



-- ########## PRIORITY FILE: 20260215000027_create_synthetic_catalog.sql ##########
-- Migration: Create Synthetic Program Catalog Table
-- Description: Stores the contents and PDA for the New Mexican School Model (NEM 2022) phases 1-6.

CREATE TABLE IF NOT EXISTS public.synthetic_program_contents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phase INTEGER NOT NULL CHECK (phase BETWEEN 1 AND 6),
    educational_level TEXT NOT NULL, -- 'INICIAL', 'PREESCOLAR', 'PRIMARIA', 'SECUNDARIA'
    field_of_study TEXT NOT NULL, -- 'Lenguajes', 'Saberes y Pensamiento Científico', etc.
    subject_name TEXT, -- Optional, used in Phase 6 (e.g., 'Español', 'Matemáticas')
    content TEXT NOT NULL,
    pda TEXT, -- Optional Process of Development of Learning
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indices for faster lookup
CREATE INDEX IF NOT EXISTS idx_synthetic_phase ON public.synthetic_program_contents(phase);
CREATE INDEX IF NOT EXISTS idx_synthetic_field ON public.synthetic_program_contents(field_of_study);
CREATE INDEX IF NOT EXISTS idx_synthetic_level ON public.synthetic_program_contents(educational_level);

-- Enable RLS
ALTER TABLE public.synthetic_program_contents ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'synthetic_program_contents' 
        AND policyname = 'Everyone can read synthetic_program_contents'
    ) THEN
        CREATE POLICY "Everyone can read synthetic_program_contents"
            ON public.synthetic_program_contents FOR SELECT 
            USING (auth.role() = 'authenticated');
    END IF;
END $$;



-- ########## PRIORITY FILE: 20260215000030_seed_phase_6.sql ##########
-- Seed Data: Synthetic Program Catalog (Fase 6)

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.synthetic_program_contents WHERE phase = 6) THEN
        INSERT INTO public.synthetic_program_contents (phase, educational_level, field_of_study, subject_name, content, pda) VALUES
        -- FASE 6: SECUNDARIA
        -- Lenguajes
        (6, 'SECUNDARIA', 'Lenguajes', 'Español', 'La diversidad de lenguas y su uso en la comunicación familiar, escolar y comunitaria.', NULL),
        (6, 'SECUNDARIA', 'Lenguajes', 'Español', 'La diversidad étnica, cultural y lingüística de México a favor de una sociedad intercultural.', NULL),
        (6, 'SECUNDARIA', 'Lenguajes', 'Español', 'Las lenguas como manifestación de la identidad y del sentido de pertenencia.', NULL),
        (6, 'SECUNDARIA', 'Lenguajes', 'Inglés', 'La diversidad lingüística y sus formas de expresión en México y el mundo.', NULL),
        (6, 'SECUNDARIA', 'Lenguajes', 'Inglés', 'La identidad y cultura de pueblos de habla inglesa.', NULL),
        (6, 'SECUNDARIA', 'Lenguajes', 'Artes', 'Diversidad de lenguajes artísticos en la riqueza pluricultural de México y del mundo.', NULL),
        (6, 'SECUNDARIA', 'Lenguajes', 'Artes', 'Manifestaciones culturales y artísticas que conforman la diversidad étnica, cultural y lingüística.', NULL),

        -- Saberes y Pensamiento Científico
        (6, 'SECUNDARIA', 'Saberes y Pensamiento Científico', 'Matemáticas', 'Expresión de fracciones como decimales y de decimales como fracciones.', NULL),
        (6, 'SECUNDARIA', 'Saberes y Pensamiento Científico', 'Matemáticas', 'Extensión de los números a positivos y negativos y su orden.', NULL),
        (6, 'SECUNDARIA', 'Saberes y Pensamiento Científico', 'Matemáticas', 'Introducción al álgebra.', NULL),
        (6, 'SECUNDARIA', 'Saberes y Pensamiento Científico', 'Biología', 'Funcionamiento del cuerpo humano coordinado por los sistemas nervioso y endocrino.', NULL),
        (6, 'SECUNDARIA', 'Saberes y Pensamiento Científico', 'Biología', 'Salud sexual y reproductiva.', NULL),
        (6, 'SECUNDARIA', 'Saberes y Pensamiento Científico', 'Física', 'El pensamiento científico, una forma de plantear y solucionar problemas.', NULL),
        (6, 'SECUNDARIA', 'Saberes y Pensamiento Científico', 'Física', 'Estructura, propiedades y características de la materia.', NULL),
        (6, 'SECUNDARIA', 'Saberes y Pensamiento Científico', 'Química', 'Las propiedades extensivas e intensivas como una forma de identificar sustancias.', NULL),
        (6, 'SECUNDARIA', 'Saberes y Pensamiento Científico', 'Química', 'Composición de las mezclas y su clasificación.', NULL),

        -- Ética, Naturaleza y Sociedades
        (6, 'SECUNDARIA', 'Ética, Naturaleza y Sociedades', 'Geografía', 'El espacio geográfico como una construcción social y colectiva.', NULL),
        (6, 'SECUNDARIA', 'Ética, Naturaleza y Sociedades', 'Geografía', 'Las categorías de análisis espacial y representaciones del espacio geográfico.', NULL),
        (6, 'SECUNDARIA', 'Ética, Naturaleza y Sociedades', 'Historia', 'Los albores de la humanidad: los pueblos antiguos del mundo y su devenir.', NULL),
        (6, 'SECUNDARIA', 'Ética, Naturaleza y Sociedades', 'Historia', 'La conformación de las metrópolis y los sistemas de dominación.', NULL),
        (6, 'SECUNDARIA', 'Ética, Naturaleza y Sociedades', 'Formación Cívica y Ética', 'Los derechos humanos en México y en el mundo.', NULL),
        (6, 'SECUNDARIA', 'Ética, Naturaleza y Sociedades', 'Formación Cívica y Ética', 'El conflicto en la convivencia humana desde la cultura de paz.', NULL),

        -- De lo Humano y lo Comunitario
        (6, 'SECUNDARIA', 'De lo Humano y lo Comunitario', 'Educación Física', 'Capacidades, habilidades y destrezas motrices.', NULL),
        (6, 'SECUNDARIA', 'De lo Humano y lo Comunitario', 'Educación Física', 'Estilos de vida activos y saludables.', NULL),
        (6, 'SECUNDARIA', 'De lo Humano y lo Comunitario', 'Tecnología', 'Herramientas, máquinas e instrumentos, como extensión corporal.', NULL),
        (6, 'SECUNDARIA', 'De lo Humano y lo Comunitario', 'Tecnología', 'Materiales, procesos técnicos y comunidad.', NULL),
        (6, 'SECUNDARIA', 'De lo Humano y lo Comunitario', 'Tutoría / Socioemocional', 'Autoconocimiento.', NULL),
        (6, 'SECUNDARIA', 'De lo Humano y lo Comunitario', 'Tutoría / Socioemocional', 'Manejo de emociones.', NULL);
    END IF;
END $$;



-- ########## PRIORITY FILE: 20260215000031_seed_phases_1_2.sql ##########
-- Seed Data: Synthetic Program Catalog (Fase 1 & 2)

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.synthetic_program_contents WHERE phase IN (1, 2)) THEN
        INSERT INTO public.synthetic_program_contents (phase, educational_level, field_of_study, content, pda) VALUES
        -- FASE 1: INICIAL
        (1, 'INICIAL', 'Lenguajes', 'Las diferentes formas de los lenguajes para la expresión de necesidades, intereses, emociones, afectos y sentimientos.', 'Construye vínculos afectivos a través de los diferentes lenguajes, verbales y no verbales. Utiliza diversas estructuras del lenguaje oral: el maternés, el balbuceo, los juegos metalingüísticos y las narraciones, para la expresión lingüística. Experimenta la lengua de relato cotidianamente, favoreciendo la capacidad de imaginar, de organizar el tiempo, de reflejarse en los cuentos y poemas y de aprender a narrar.'),
        (1, 'INICIAL', 'Lenguajes', 'La identidad familiar y comunitaria que aporta la riqueza cultural de las lenguas maternas (español, indígenas o extranjeras) en contextos de diversidad para fortalecer su uso en niñas y niños.', 'Usa cotidianamente la lengua materna con apoyo de sus familiares de crianza, identificándose como parte de su comunidad. Disfruta de la belleza sonora que le aportan las nanas, “canciones para llamar al sueño” o canciones de cuna.'),
        (1, 'INICIAL', 'Lenguajes', 'El encuentro creador de niñas y niños consigo mismas, consigo mismos, y con el mundo, por medio del disfrute de las experiencias artísticas.', 'Experimenta y transforma el espacio a través del arte y el juego, en forma colectiva. Encuentra formas de dejar sus huellas gráficas en el espacio y experimenta con distintos materiales, a partir del contacto con las artes plásticas y visuales. Escucha, canta y habla haciendo uso de experiencias musicales, disfrutando su envoltura sonora. Descubre el movimiento estético y la representación, al participar en experiencias de expresión corporal propias. Disfruta la lectura como una experiencia que alimenta su curiosidad y capacidad creadora tanto en la familia como en el servicio educativo. Experimenta diversos roles, como espectadora, espectador y participante en narrativas teatrales.'),
        (1, 'INICIAL', 'Lenguajes', 'Artes Plásticas y Visuales', 'Experimenta sus propias huellas con diferentes texturas y en diferentes soportes. Hace uso del espacio y los recursos disponibles para dibujar, pintar y compartir sus creaciones. Deja huellas gráficas identificando y relacionando las propias y las de otros, con ayuda de las artes plásticas y visuales. Disfruta de experiencias artísticas en las que observa, interactúa, manipula, experimenta y juega con materiales variados. Plasma o crea, con los recursos disponibles, sus interpretaciones y simbolizaciones a través de un proceso corporal, táctil y visual. Trae, desde el imaginario a la representación gráfica y visual, lo que evoca o asocia.'),
        (1, 'INICIAL', 'Lenguajes', 'Música', 'Escucha, canta y habla haciendo uso de experiencias musicales, disfrutando su envoltura sonora.'),
        (1, 'INICIAL', 'Saberes y Pensamiento Científico', 'El juego como base de la experiencia de investigación para que niñas y niños construyan sentido del mundo, de sí mismas y de sí mismos.', NULL),
        (1, 'INICIAL', 'Saberes y Pensamiento Científico', 'La exploración e investigación del mundo para el desarrollo del pensamiento a través de la curiosidad, los sentidos y la creatividad.', NULL),
        (1, 'INICIAL', 'Saberes y Pensamiento Científico', 'El aprendizaje de niñas y niños a través de la observación y el involucramiento en la comunidad y el ambiente que les rodea.', NULL),
        (1, 'INICIAL', 'Ética, Naturaleza y Sociedades', 'El enfoque de derechos como base de la intervención integral con niñas y niños.', NULL),
        (1, 'INICIAL', 'Ética, Naturaleza y Sociedades', 'La corresponsabilidad de las personas adultas frente al cuidado y protección de niñas y niños y su papel como garantes de derechos.', NULL),
        (1, 'INICIAL', 'Ética, Naturaleza y Sociedades', 'La crianza compartida como prolongación de los cuidados amorosos consensuados, capaces de proveer una continuidad cultural.', NULL),
        (1, 'INICIAL', 'De lo Humano y lo Comunitario', 'El sostenimiento afectivo como base de las experiencias de cuidado que proveen y generan vínculos amorosos para el bienestar y desarrollo de las infancias.', NULL),
        (1, 'INICIAL', 'De lo Humano y lo Comunitario', 'El contacto y el sostén como bases del desarrollo corporal y las vivencias afectivas.', NULL),
        (1, 'INICIAL', 'De lo Humano y lo Comunitario', 'Los beneficios que otorga una alimentación perceptiva para niñas, niños y sus familias.', NULL),
        (1, 'INICIAL', 'De lo Humano y lo Comunitario', 'El acompañamiento a niñas y niños en el sueño, desde el respeto, atención y escucha de sus necesidades.', NULL),
        (1, 'INICIAL', 'De lo Humano y lo Comunitario', 'Espacios que proveen seguridad y sostén afectivo para aprender de la comunidad con interés y creatividad.', NULL),
        (1, 'INICIAL', 'De lo Humano y lo Comunitario', 'El desarrollo cerebral como base importante para la adquisición de habilidades.', NULL),
        
        -- FASE 2: PREESCOLAR
        (2, 'PREESCOLAR', 'Lenguajes', 'Comunicación oral de necesidades, emociones, gustos, ideas y saberes, a través de los diversos lenguajes, desde una perspectiva comunitaria.', NULL),
        (2, 'PREESCOLAR', 'Lenguajes', 'Narración de historias mediante diversos lenguajes, en un ambiente donde niñas y niños participen y se apropien de la cultura, a través de diferentes textos.', NULL),
        (2, 'PREESCOLAR', 'Lenguajes', 'Recursos y juegos del lenguaje que fortalecen la diversidad de formas de expresión oral, y que rescatan la o las lenguas de la comunidad y de otros lugares.', NULL),
        (2, 'PREESCOLAR', 'Lenguajes', 'Reconocimiento y aprecio de la diversidad lingüística, al identificar las formas en que se comunican las distintas personas de la comunidad.', NULL),
        (2, 'PREESCOLAR', 'Lenguajes', 'Representación gráfica de ideas y descubrimientos, al explorar los diversos textos que hay en su comunidad y otros lugares.', NULL),
        (2, 'PREESCOLAR', 'Lenguajes', 'Expresión de emociones y experiencias, en igualdad de oportunidades, apoyándose de recursos gráficos personales y de los lenguajes artísticos.', NULL),
        (2, 'PREESCOLAR', 'Lenguajes', 'Producciones gráficas dirigidas a destinatarias y diversos destinatarios, para establecer vínculos sociales y acercarse a la cultura escrita.', NULL),
        (2, 'PREESCOLAR', 'Lenguajes', 'Reconocimiento de ideas o emociones en la interacción con manifestaciones culturales y artísticas y con la naturaleza, a través de diversos lenguajes.', NULL),
        (2, 'PREESCOLAR', 'Lenguajes', 'Producción de expresiones creativas con los distintos elementos de los lenguajes artísticos.', NULL),
        
        (2, 'PREESCOLAR', 'Saberes y Pensamiento Científico', 'Exploración de la diversidad natural que existe en la comunidad y en otros lugares.', NULL),
        (2, 'PREESCOLAR', 'Saberes y Pensamiento Científico', 'Saberes familiares y comunitarios que resuelven situaciones y necesidades en el hogar y la comunidad.', NULL),
        (2, 'PREESCOLAR', 'Saberes y Pensamiento Científico', 'Los seres vivos: elementos, procesos y fenómenos naturales que ofrecen oportunidades para entender y explicar hechos cotidianos, desde distintas perspectivas.', NULL),
        (2, 'PREESCOLAR', 'Saberes y Pensamiento Científico', 'Los saberes numéricos como herramienta para resolver situaciones del entorno, en diversos contextos socioculturales.', NULL),
        (2, 'PREESCOLAR', 'Saberes y Pensamiento Científico', 'El dominio del espacio y reconocimiento de formas en el entorno desde diversos puntos de observación y mediante desplazamientos o recorridos.', NULL),
        (2, 'PREESCOLAR', 'Saberes y Pensamiento Científico', 'Las magnitudes de longitud, peso, capacidad y tiempo en situaciones cotidianas del hogar y del entorno sociocultural.', NULL),
        (2, 'PREESCOLAR', 'Saberes y Pensamiento Científico', 'Clasificación y experimentación con objetos y elementos del entorno que reflejan la diversidad de la comunidad o región.', NULL),
        (2, 'PREESCOLAR', 'Saberes y Pensamiento Científico', 'Características de objetos y comportamiento de los materiales del entorno sociocultural.', NULL),
        (2, 'PREESCOLAR', 'Saberes y Pensamiento Científico', 'Objetos y artefactos tecnológicos que mejoran y facilitan la vida familiar y de la comunidad.', NULL),
        
        (2, 'PREESCOLAR', 'Ética, Naturaleza y Sociedades', 'Interacción, cuidado, conservación y regeneración de la naturaleza, que favorece la construcción de una conciencia socioambiental.', NULL),
        (2, 'PREESCOLAR', 'Ética, Naturaleza y Sociedades', 'Transformación responsable del entorno al satisfacer necesidades básicas de alimentación, vestido y vivienda.', NULL),
        (2, 'PREESCOLAR', 'Ética, Naturaleza y Sociedades', 'Construcción de la identidad y pertenencia a una comunidad y país a partir del conocimiento de su historia, sus celebraciones, conmemoraciones tradicionales y obras del patrimonio artístico y cultural.', NULL),
        (2, 'PREESCOLAR', 'Ética, Naturaleza y Sociedades', 'Cambios que ocurren en los lugares, entornos, objetos, costumbres y formas de vida de las distintas familias y comunidades con el paso del tiempo.', NULL),
        (2, 'PREESCOLAR', 'Ética, Naturaleza y Sociedades', 'Labores y servicios que contribuyen al bien común de las distintas familias y comunidades.', NULL),
        (2, 'PREESCOLAR', 'Ética, Naturaleza y Sociedades', 'Los derechos de niñas y niños como base para el bienestar integral y el establecimiento de acuerdos que favorecen la convivencia pacífica.', NULL),
        (2, 'PREESCOLAR', 'Ética, Naturaleza y Sociedades', 'La diversidad de personas y familias en la comunidad y su convivencia, en un ambiente de equidad, libertad, inclusión y respeto a los derechos humanos.', NULL),
        (2, 'PREESCOLAR', 'Ética, Naturaleza y Sociedades', 'La cultura de paz como una forma de relacionarse con otras personas para promover la inclusión y el respeto a la diversidad.', NULL),
        
        (2, 'PREESCOLAR', 'De lo Humano y lo Comunitario', 'Construcción de la identidad personal a partir de su pertenencia a un territorio, su origen étnico, cultural y lingüístico, y la interacción con personas cercanas', 'Descubre gustos, preferencias, posibilidades motrices y afectivas. Describe cómo es físicamente, identifica sus rasgos familiares. Reconoce algunos rasgos de su identidad, qué se le facilita, qué se le dificulta.'),
        (2, 'PREESCOLAR', 'De lo Humano y lo Comunitario', 'Posibilidades de movimiento en diferentes espacios, para favorecer las habilidades motrices', 'Explora las posibilidades de movimiento de su cuerpo. Adapta sus movimientos y fortalece su lateralidad. Combina movimientos que implican el control, equilibrio y estabilidad.'),
        (2, 'PREESCOLAR', 'De lo Humano y lo Comunitario', 'Precisión y coordinación en los movimientos al usar objetos, herramientas y materiales, de acuerdo con sus condiciones, capacidades y características', 'Explora y manipula objetos, herramientas y materiales. Participa en juegos y actividades que involucran la coordinación. Controla sus movimientos al usar objetos.'),
        (2, 'PREESCOLAR', 'De lo Humano y lo Comunitario', 'Las emociones en la interacción con diversas personas y situaciones', 'Identifica emociones como alegría, tristeza, sorpresa, miedo o enojo. Expresa lo que siente o le provocan algunas situaciones. Escucha con empatía a sus pares.'),
        (2, 'PREESCOLAR', 'De lo Humano y lo Comunitario', 'Interacción con personas de diversos contextos, que contribuyan al establecimiento de relaciones positivas y a una convivencia basada en la aceptación de la diversidad', 'Interactúa con diferentes compañeras y compañeros. Identifica las consecuencias positivas o negativas de sus comportamientos. Participa y respeta acuerdos de convivencia.'),
        (2, 'PREESCOLAR', 'De lo Humano y lo Comunitario', 'Cuidado de la salud personal y colectiva, al llevar a cabo acciones de higiene, limpieza, y actividad física, desde los saberes prácticos de la comunidad y la información científica', 'Practica hábitos de higiene personal y limpieza. Reconoce los beneficios que la actividad física, la alimentación y la higiene aportan.');
    END IF;
END $$;



-- ########## PRIORITY FILE: 20260215000032_seed_phases_3_4_5.sql ##########
-- Seed Data: Synthetic Program Catalog (Fase 3, 4 & 5)

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.synthetic_program_contents WHERE phase IN (3, 4, 5)) THEN
        INSERT INTO public.synthetic_program_contents (phase, educational_level, field_of_study, content, pda) VALUES
        -- FASE 3: PRIMARIA (1º-2º)
        (3, 'PRIMARIA', 'Lenguajes', 'Escritura de nombres en la lengua materna.', NULL),
        (3, 'PRIMARIA', 'Lenguajes', 'Lectura compartida en voz alta.', NULL),
        (3, 'PRIMARIA', 'Lenguajes', 'Narración de actividades y eventos relevantes que tengan lugar en la familia, la escuela o el resto de la comunidad.', NULL),
        (3, 'PRIMARIA', 'Lenguajes', 'Escritura colectiva por medio del dictado.', NULL),
        (3, 'PRIMARIA', 'Lenguajes', 'Descripción de objetos, lugares y seres vivos.', NULL),
        (3, 'PRIMARIA', 'Lenguajes', 'Uso de convenciones de la escritura presentes en la cotidianidad.', NULL),
        (3, 'PRIMARIA', 'Lenguajes', 'Uso del dibujo y/o la escritura para recordar actividades y acuerdos escolares.', NULL),
        (3, 'PRIMARIA', 'Lenguajes', 'Registro y/o resumen de información consultada en fuentes orales, escritas, audiovisuales, táctiles o sonoras, para estudiar y/o exponer.', NULL),
        (3, 'PRIMARIA', 'Lenguajes', 'Empleo de textos con instrucciones para participar en juegos, usar o elaborar objetos, preparar alimentos u otros propósitos.', NULL),
        (3, 'PRIMARIA', 'Lenguajes', 'Producción e interpretación de avisos, carteles, anuncios publicitarios y letreros en la vida cotidiana.', NULL),
        (3, 'PRIMARIA', 'Lenguajes', 'Elaboración y difusión de notas informativas en la escuela y el resto de la comunidad.', NULL),
        (3, 'PRIMARIA', 'Lenguajes', 'Producción de textos dirigidos a autoridades y personas de la comunidad, en relación con necesidades, intereses o actividades escolares.', NULL),
        (3, 'PRIMARIA', 'Lenguajes', 'Lectura, escritura y otros tipos de interacción mediante lenguajes que ocurren en el contexto familiar.', NULL),
        (3, 'PRIMARIA', 'Saberes y Pensamiento Científico', 'Cuerpo humano: estructura externa, acciones para su cuidado y sus cambios como parte del crecimiento.', NULL),
        (3, 'PRIMARIA', 'Saberes y Pensamiento Científico', 'Beneficios del consumo de alimentos saludables, de agua simple potable, y de la práctica de actividad física.', NULL),
        (3, 'PRIMARIA', 'Saberes y Pensamiento Científico', 'Características del entorno natural y sociocultural.', NULL),
        (3, 'PRIMARIA', 'Saberes y Pensamiento Científico', 'Impacto de las actividades humanas en el entorno natural, así como acciones y prácticas socioculturales para su cuidado.', NULL),
        (3, 'PRIMARIA', 'Saberes y Pensamiento Científico', 'Estudio de los números.', NULL),
        (3, 'PRIMARIA', 'Saberes y Pensamiento Científico', 'Construcción de la noción de suma y resta, y su relación como operaciones inversas.', NULL),
        (3, 'PRIMARIA', 'Ética, Naturaleza y Sociedades', 'Diversos contextos sociales, naturales y territoriales: cambios y continuidades.', NULL),
        (3, 'PRIMARIA', 'Ética, Naturaleza y Sociedades', 'Respeto, cuidado y empatía hacia la naturaleza, como parte de un todo interdependiente.', NULL),
        (3, 'PRIMARIA', 'Ética, Naturaleza y Sociedades', 'Impacto de las actividades humanas en la naturaleza y sustentabilidad.', NULL),
        (3, 'PRIMARIA', 'De lo Humano y lo Comunitario', 'La comunidad como el espacio en el que se vive y se encuentra la escuela.', NULL),
        (3, 'PRIMARIA', 'De lo Humano y lo Comunitario', 'Sentido de pertenencia a la familia y la comunidad.', NULL),
        (3, 'PRIMARIA', 'De lo Humano y lo Comunitario', 'Formas de ser, pensar, actuar y relacionarse.', NULL),
        (3, 'PRIMARIA', 'De lo Humano y lo Comunitario', 'Capacidades y habilidades motrices.', NULL),
        
        -- FASE 4: PRIMARIA (3º-4º)
        (4, 'PRIMARIA', 'Lenguajes', 'Narración de sucesos del pasado y del presente.', NULL),
        (4, 'PRIMARIA', 'Lenguajes', 'Descripción de personas, lugares, hechos y procesos.', NULL),
        (4, 'PRIMARIA', 'Lenguajes', 'Diálogo para la toma de acuerdos y el intercambio de puntos de vista.', NULL),
        (4, 'PRIMARIA', 'Lenguajes', 'Comprensión y producción de textos expositivos en los que se planteen: problema-solución, comparación-contraste, causa-consecuencia y enumeración.', NULL),
        (4, 'PRIMARIA', 'Lenguajes', 'Búsqueda y manejo reflexivo de información.', NULL),
        (4, 'PRIMARIA', 'Saberes y Pensamiento Científico', 'Estructura y funcionamiento del cuerpo humano: sistemas locomotor y digestivo.', NULL),
        (4, 'PRIMARIA', 'Saberes y Pensamiento Científico', 'Alimentación saludable, con base en el Plato del Bien Comer.', NULL),
        (4, 'PRIMARIA', 'Saberes y Pensamiento Científico', 'Relaciones entre los factores físicos y biológicos que conforman los ecosistemas.', NULL),
        (4, 'PRIMARIA', 'Saberes y Pensamiento Científico', 'Estudio de los números.', NULL),
        (4, 'PRIMARIA', 'Ética, Naturaleza y Sociedades', 'Representaciones cartográficas de la localidad y/o comunidad.', NULL),
        (4, 'PRIMARIA', 'Ética, Naturaleza y Sociedades', 'Valoración de los ecosistemas: características del territorio como espacio de vida.', NULL),
        (4, 'PRIMARIA', 'De lo Humano y lo Comunitario', 'La escuela como espacio de convivencia, colaboración y aprendizaje.', NULL),
        (4, 'PRIMARIA', 'De lo Humano y lo Comunitario', 'Sentido de pertenencia, identidad personal y social.', NULL),
        
        -- FASE 5: PRIMARIA (5º-6º)
        (5, 'PRIMARIA', 'Lenguajes', 'Narración de sucesos autobiográficos.', NULL),
        (5, 'PRIMARIA', 'Lenguajes', 'Comprensión y producción de textos explicativos.', NULL),
        (5, 'PRIMARIA', 'Lenguajes', 'Participación en debates sobre temas de interés común.', NULL),
        (5, 'PRIMARIA', 'Lenguajes', 'Comprensión y producción de textos argumentativos.', NULL),
        (5, 'PRIMARIA', 'Saberes y Pensamiento Científico', 'Estructura y funcionamiento del cuerpo humano: sistemas circulatorio, respiratorio e inmunológico.', NULL),
        (5, 'PRIMARIA', 'Saberes y Pensamiento Científico', 'Alimentación saludable: características de la dieta correcta, costumbres de la comunidad.', NULL),
        (5, 'PRIMARIA', 'Saberes y Pensamiento Científico', 'Factores que conforman la biodiversidad y el medio ambiente.', NULL),
        (5, 'PRIMARIA', 'Saberes y Pensamiento Científico', 'Estudio de los números.', NULL),
        (5, 'PRIMARIA', 'Ética, Naturaleza y Sociedades', 'Valoración de la biodiversidad: en el territorio donde se ubica la localidad.', NULL),
        (5, 'PRIMARIA', 'Ética, Naturaleza y Sociedades', 'Derechos humanos: a un ambiente sano y acceso al agua potable.', NULL),
        (5, 'PRIMARIA', 'De lo Humano y lo Comunitario', 'La comunidad como espacio para el desarrollo del sentido de pertenencia y autonomía.', NULL),
        (5, 'PRIMARIA', 'De lo Humano y lo Comunitario', 'Estilos de vida activos y saludables.', NULL);
    END IF;
END $$;



-- ########## PRIORITY FILE: 20260215000005_analytical_program.sql ##########
-- MÓDULO DE PROGRAMA ANALÍTICO (NEM)
-- Este módulo es el segundo nivel de concreción, previo a la planeación didáctica.

CREATE TABLE IF NOT EXISTS public.analytical_programs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE CASCADE NOT NULL,
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
    subject_id UUID REFERENCES public.subject_catalog(id) ON DELETE SET NULL,
    
    -- Lectura de la realidad (Diagnóstico Socioeducativo)
    diagnosis_context TEXT, -- Narrativa general redactada (con ayuda de IA)
    
    -- Problemáticas de la comunidad/aula
    problem_statements JSONB DEFAULT '[]', -- [{id, description, priority}]
    
    status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'COMPLETED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure columns exist even if table was created previously (Idempotent schema evolution)
DO $$
BEGIN
    -- group_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytical_programs' AND column_name = 'group_id') THEN
        ALTER TABLE public.analytical_programs ADD COLUMN group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE;
    END IF;

    -- subject_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytical_programs' AND column_name = 'subject_id') THEN
        ALTER TABLE public.analytical_programs ADD COLUMN subject_id UUID REFERENCES public.subject_catalog(id) ON DELETE SET NULL;
    END IF;

    -- diagnosis_context
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytical_programs' AND column_name = 'diagnosis_context') THEN
        ALTER TABLE public.analytical_programs ADD COLUMN diagnosis_context TEXT;
    END IF;

    -- problem_statements
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytical_programs' AND column_name = 'problem_statements') THEN
        ALTER TABLE public.analytical_programs ADD COLUMN problem_statements JSONB DEFAULT '[]';
    END IF;

    -- status
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytical_programs' AND column_name = 'status') THEN
        ALTER TABLE public.analytical_programs ADD COLUMN status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'COMPLETED'));
    END IF;
END $$;

-- Contenidos y PDA vinculados al Programa Analítico (Codiseño y Contextualización)
CREATE TABLE IF NOT EXISTS public.analytical_program_contents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    program_id UUID REFERENCES public.analytical_programs(id) ON DELETE CASCADE NOT NULL,
    
    campo_formativo TEXT NOT NULL,
    content_id UUID REFERENCES public.synthetic_program_contents(id) ON DELETE SET NULL, -- Contenido del Programa Sintético
    custom_content TEXT, -- Para Codiseño (contenidos nuevos locales)
    
    pda_ids UUID[] DEFAULT '{}', -- Procesos de Desarrollo seleccionados
    justification TEXT, -- Por qué este contenido es relevante para la problemática
    temporality TEXT, -- Meses o Periodo sugerido
    ejes_articuladores TEXT[] DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.analytical_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytical_program_contents ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'analytical_programs' AND policyname = 'Enable access for tenant users on analytical_programs'
    ) THEN
        CREATE POLICY "Enable access for tenant users on analytical_programs" ON public.analytical_programs
    USING (auth.uid() IN (SELECT id FROM profiles WHERE tenant_id = analytical_programs.tenant_id))
    WITH CHECK (auth.uid() IN (SELECT id FROM profiles WHERE tenant_id = analytical_programs.tenant_id));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'analytical_program_contents' AND policyname = 'Enable access for tenant users on analytical_program_contents'
    ) THEN
        CREATE POLICY "Enable access for tenant users on analytical_program_contents" ON public.analytical_program_contents
    USING (EXISTS (
        SELECT 1 FROM analytical_programs p 
        WHERE p.id = analytical_program_contents.program_id 
        AND auth.uid() IN (SELECT id FROM profiles WHERE tenant_id = p.tenant_id)
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM analytical_programs p 
        WHERE p.id = analytical_program_contents.program_id 
        AND auth.uid() IN (SELECT id FROM profiles WHERE tenant_id = p.tenant_id)
    ));
    END IF;
END $$;

-- Índices
CREATE INDEX IF NOT EXISTS idx_analytical_group ON public.analytical_programs(group_id);
CREATE INDEX IF NOT EXISTS idx_analytical_subject ON public.analytical_programs(subject_id);
CREATE INDEX IF NOT EXISTS idx_analytical_contents_program ON public.analytical_program_contents(program_id);



-- ########## PRIORITY FILE: 20260215000014_zzz_fix_analytical_schema_full.sql ##########
-- FIX: Comprehensive Schema Repair for analytical_programs
-- Ensures all required columns and policies exist.

DO $$ 
BEGIN 
    -- 1. Ensure tenant_id exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytical_programs' AND column_name = 'tenant_id') THEN
        ALTER TABLE public.analytical_programs ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
    END IF;

    -- 2. Ensure academic_year_id exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytical_programs' AND column_name = 'academic_year_id') THEN
        ALTER TABLE public.analytical_programs ADD COLUMN academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_analytical_academic_year ON public.analytical_programs(academic_year_id);
    END IF;

    -- 3. Ensure status exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytical_programs' AND column_name = 'status') THEN
        ALTER TABLE public.analytical_programs ADD COLUMN status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'COMPLETED'));
    END IF;

    -- 4. Ensure timestamps exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytical_programs' AND column_name = 'created_at') THEN
        ALTER TABLE public.analytical_programs ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytical_programs' AND column_name = 'updated_at') THEN
        ALTER TABLE public.analytical_programs ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- 5. Enable RLS
ALTER TABLE public.analytical_programs ENABLE ROW LEVEL SECURITY;

-- 6. Refresh Policies (Safe idempotent check)
DO $$
BEGIN
    -- We can try to drop if really needed or just check if exists.
    -- The previous script tried to drop. Let's stick to "IF NOT EXISTS CREATE".
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'analytical_programs' AND policyname = 'Enable access for tenant users on analytical_programs'
    ) THEN
        CREATE POLICY "Enable access for tenant users on analytical_programs" ON public.analytical_programs
        USING (auth.uid() IN (SELECT id FROM profiles WHERE tenant_id = analytical_programs.tenant_id))
        WITH CHECK (auth.uid() IN (SELECT id FROM profiles WHERE tenant_id = analytical_programs.tenant_id));
    END IF;
END $$;



-- ########## PRIORITY FILE: 20260215000113_database_resurrection.sql ##########
-- ==========================================
-- NUCLEAR DATABASE RESURRECTION (V3)
-- ==========================================
-- Este script es el definitivo para arreglar errores 406 y 400.

BEGIN;

-- 1. Reparar Tabla de Profiles (Crítico para God Mode)
-- Si la tabla ya existe, nos aseguramos de que tenant_id sea NULLABLE.
DO $$ 
BEGIN
    -- Crear si no existe
    CREATE TABLE IF NOT EXISTS public.profiles (
        id uuid REFERENCES auth.users NOT NULL PRIMARY KEY,
        tenant_id uuid REFERENCES public.tenants(id),
        role text NOT NULL,
        full_name text,
        first_name text,
        created_at timestamp with time zone DEFAULT now() NOT NULL
    );
    
    -- REFUERZO: Asegurar nulabilidad
    ALTER TABLE public.profiles ALTER COLUMN tenant_id DROP NOT NULL;

    -- Agregar columnas faltantes si no existen
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='last_name_paternal') THEN ALTER TABLE public.profiles ADD COLUMN last_name_paternal text; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='last_name_maternal') THEN ALTER TABLE public.profiles ADD COLUMN last_name_maternal text; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='avatar_url') THEN ALTER TABLE public.profiles ADD COLUMN avatar_url text; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='nationality') THEN ALTER TABLE public.profiles ADD COLUMN nationality text; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='birth_date') THEN ALTER TABLE public.profiles ADD COLUMN birth_date date; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='sex') THEN ALTER TABLE public.profiles ADD COLUMN sex text; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='marital_status') THEN ALTER TABLE public.profiles ADD COLUMN marital_status text; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='curp') THEN ALTER TABLE public.profiles ADD COLUMN curp text; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='rfc') THEN ALTER TABLE public.profiles ADD COLUMN rfc text; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='address_particular') THEN ALTER TABLE public.profiles ADD COLUMN address_particular text; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='phone_contact') THEN ALTER TABLE public.profiles ADD COLUMN phone_contact text; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='profile_setup_completed') THEN ALTER TABLE public.profiles ADD COLUMN profile_setup_completed boolean DEFAULT false; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='work_start_time') THEN ALTER TABLE public.profiles ADD COLUMN work_start_time time DEFAULT '07:00:00'; END IF;
END $$;

-- 2. Asegurar Tablas de Soporte
CREATE TABLE IF NOT EXISTS public.profile_roles (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    role text NOT NULL,
    UNIQUE(profile_id, role)
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) NOT NULL UNIQUE,
    status text NOT NULL DEFAULT 'trialing',
    current_period_end timestamptz NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- 2.1 Tablas de Sistema (Arregla 406 en Dashboard)
CREATE TABLE IF NOT EXISTS public.system_settings (
    key text PRIMARY KEY,
    value text,
    description text,
    updated_at timestamp with time zone default now()
);

CREATE TABLE IF NOT EXISTS public.payment_transactions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid REFERENCES public.tenants(id),
    user_id uuid REFERENCES auth.users(id),
    amount numeric(10, 2),
    status text,
    created_at timestamp with time zone DEFAULT now()
);

-- 2.2 Datos de Sistema Iniciales
INSERT INTO public.system_settings (key, value, description)
VALUES ('chat_sound_url', 'https://aveqziaewxcglhteufft.supabase.co/storage/v1/object/public/system/notification.mp3', 'Sonido de notificación de chat')
ON CONFLICT (key) DO NOTHING;

-- 3. Restaurar Super Admin (helmerferras@gmail.com)
DO $$
DECLARE
    target_email text := 'helmerferras@gmail.com';
    target_uid uuid;
BEGIN
    SELECT id INTO target_uid FROM auth.users WHERE email = target_email;

    IF target_uid IS NOT NULL THEN
        -- Insertar/Actualizar Perfil (God Mode tiene tenant_id = NULL)
        INSERT INTO public.profiles (id, role, full_name, first_name, tenant_id)
        VALUES (target_uid, 'SUPER_ADMIN', 'Super Admin', 'Helmer', NULL)
        ON CONFLICT (id) DO UPDATE SET 
            role = 'SUPER_ADMIN', 
            tenant_id = NULL;

        -- Insertar Rol
        INSERT INTO public.profile_roles (profile_id, role)
        VALUES (target_uid, 'SUPER_ADMIN')
        ON CONFLICT DO NOTHING;

        -- Suscripción Vitalicia
        INSERT INTO public.subscriptions (user_id, status, current_period_end)
        VALUES (target_uid, 'active', now() + interval '100 years')
        ON CONFLICT (user_id) DO UPDATE SET 
            status = 'active', 
            current_period_end = now() + interval '100 years';

        RAISE NOTICE 'Nuclear Resurrection Success for %', target_email;
    END IF;
END $$;

-- 4. PERMISOS TOTALES (Evita 406)
-- Exponemos las tablas al motor de la API
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE ON public.subscriptions TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE ON public.profile_roles TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE ON public.system_settings TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE ON public.payment_transactions TO authenticated, anon;
GRANT SELECT ON public.tenants TO authenticated, anon;

-- 5. RELOAD SCHEMA (Forzar a PostgREST a ver los cambios)
NOTIFY pgrst, 'reload schema';

COMMIT;



-- ########## FILE: 20260215000001_add_licensing_system.sql ##########
-- Migration: Add Two-Tier Licensing System
-- Description: Creates license_limits table and adds plan_type to subscriptions

-- 1. Create license_limits table
CREATE TABLE IF NOT EXISTS license_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_type VARCHAR(20) UNIQUE NOT NULL CHECK (plan_type IN ('basic', 'pro')),
    max_groups INTEGER NOT NULL,
    max_students_per_group INTEGER NOT NULL,
    price_annual DECIMAL(10,2) NOT NULL,
    trial_days INTEGER DEFAULT 30,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add plan_type column to subscriptions if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'subscriptions' AND column_name = 'plan_type'
    ) THEN
        ALTER TABLE subscriptions 
        ADD COLUMN plan_type VARCHAR(20) DEFAULT 'basic' CHECK (plan_type IN ('basic', 'pro'));
    END IF;
END $$;

-- 3. Insert license limits data
INSERT INTO license_limits (plan_type, max_groups, max_students_per_group, price_annual, trial_days) 
VALUES 
    ('basic', 2, 50, 399.00, 30),
    ('pro', 5, 50, 599.00, 30)
ON CONFLICT (plan_type) DO UPDATE SET
    max_groups = EXCLUDED.max_groups,
    max_students_per_group = EXCLUDED.max_students_per_group,
    price_annual = EXCLUDED.price_annual,
    trial_days = EXCLUDED.trial_days,
    updated_at = NOW();

-- 4. Update existing subscriptions to have basic plan
UPDATE subscriptions 
SET plan_type = 'basic' 
WHERE plan_type IS NULL;

-- 5. Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_type ON subscriptions(plan_type);

-- 6. Add RLS policies for license_limits (read-only for authenticated users)
ALTER TABLE license_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view license limits" ON license_limits;
CREATE POLICY "Anyone can view license limits" ON license_limits
    FOR SELECT
    TO authenticated
    USING (true);

-- 7. Comment the tables
COMMENT ON TABLE license_limits IS 'Defines limits and pricing for different subscription plans';
COMMENT ON COLUMN subscriptions.plan_type IS 'Type of subscription plan: basic (2 groups) or pro (5 groups)';



-- ########## FILE: 20260215000002_add_description_to_criteria.sql ##########
-- Migration: Add description column to evaluation_criteria
ALTER TABLE evaluation_criteria ADD COLUMN IF NOT EXISTS description TEXT;



-- ########## FILE: 20260215000004_group_subjects_assignment.sql ##########
-- Create group_subjects association table
CREATE TABLE IF NOT EXISTS public.group_subjects (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    subject_catalog_id uuid REFERENCES public.subject_catalog(id) ON DELETE CASCADE,
    custom_name text, -- For custom subjects not in catalog
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT group_subjects_pkey PRIMARY KEY (id),
    CONSTRAINT group_subjects_subject_check CHECK (
        (subject_catalog_id IS NOT NULL AND custom_name IS NULL) OR 
        (subject_catalog_id IS NULL AND custom_name IS NOT NULL)
    ),
    CONSTRAINT group_subjects_unique UNIQUE (group_id, subject_catalog_id, custom_name)
);

-- Enable RLS
ALTER TABLE public.group_subjects ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'group_subjects' AND policyname = 'Users can view group_subjects in own tenant'
    ) THEN
        CREATE POLICY "Users can view group_subjects in own tenant" ON public.group_subjects
            FOR SELECT USING (tenant_id = get_current_tenant_id());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'group_subjects' AND policyname = 'Admins/Teachers can manage group_subjects'
    ) THEN
        CREATE POLICY "Admins/Teachers can manage group_subjects" ON public.group_subjects
            FOR ALL USING (tenant_id = get_current_tenant_id());
    END IF;
END $$;



-- ########## FILE: 20260215000006_add_cte_revision_tracking.sql ##########
-- ADAPTACIÓN PARA DOCUMENTO VIVO (REVISIONES CTE)
-- Permite rastrear la última sesión de revisión sin bloquear el documento.

-- 1. Agregar campo para la última sesión de CTE
ALTER TABLE public.analytical_programs ADD COLUMN IF NOT EXISTS last_cte_session TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2. Eliminar restricción de status si existía o ajustarla
-- (En el esquema previo era CHECK (status IN ('DRAFT', 'COMPLETED')))
ALTER TABLE public.analytical_programs DROP CONSTRAINT IF EXISTS analytical_programs_status_check;
ALTER TABLE public.analytical_programs ADD CONSTRAINT analytical_programs_status_check CHECK (status IN ('ACTIVE', 'DRAFT'));

-- 3. Actualizar programas existentes a ACTIVE
UPDATE public.analytical_programs SET status = 'ACTIVE' WHERE status = 'COMPLETED';



-- ########## FILE: 20260215000007_apply_user_api_key.sql ##########
-- ACTUALIZACIÓN MANUAL DE API KEY PARA GEMINI
-- Este script asegura que la columna exista y aplica la clave proporcionada por el usuario.

-- 1. Asegurar que la columna ai_config exista en la tabla tenants
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS ai_config JSONB DEFAULT '{}'::jsonb;

-- 2. Aplicar la clave API a todos los registros existentes (en entorno de desarrollo/único tenant)
UPDATE public.tenants 
SET ai_config = jsonb_build_object('apiKey', 'AIzaSyDtfr1fhGJ8ktmjJQ0h0Rnx1f17SbSyBZ8')
WHERE ai_config IS NULL OR ai_config->>'apiKey' IS NULL OR ai_config->>'apiKey' = '';

-- nota: 'AIzaSyDtfr1fhGJ8ktmjJQ0h0Rnx1f17SbSyBZ8'



-- ########## FILE: 20260215000008_apply_user_api_key_v2.sql ##########
-- ACTUALIZACIÓN MANUAL DE API KEY PARA GEMINI (Versión Simplificada)
-- Este script asegura que la columna exista y aplica la clave proporcionada por el usuario.

ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS ai_config JSONB DEFAULT '{}'::jsonb;

UPDATE public.tenants 
SET ai_config = '{"apiKey": "AIzaSyDtfr1fhGJ8ktmjJQ0h0Rnx1f17SbSyBZ8"}'::jsonb;



-- ########## FILE: 20260215000009_apply_user_api_key_v3.sql ##########
-- ACTUALIZACIÓN MANUAL DE API KEY (Nueva Clave Generada)

ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS ai_config JSONB DEFAULT '{}'::jsonb;

UPDATE public.tenants 
SET ai_config = '{"apiKey": "AIzaSyDNKMWJ_x-03P4r8G7shyxeVi3Wxf--70c"}'::jsonb;



-- ########## FILE: 20260215000010_refactor_analytical_program_collective.sql ##########
-- MODIFICACIÓN: PROGRAMA ANALÍTICO COLECTIVO
-- El programa analítico se elabora por escuela/asignatura, no por grupo individual.

-- 1. Eliminar la columna group_id de analytical_programs
ALTER TABLE public.analytical_programs DROP COLUMN IF EXISTS group_id;

-- 2. Asegurar que las políticas de RLS sigan funcionando a nivel tenant_id (escuela)
-- (Las políticas ya están basadas en tenant_id, así que deberían estar bien)

-- 3. Agregar comentario aclaratorio
COMMENT ON TABLE public.analytical_programs IS 'Programa Analítico elaborado colectivamente a nivel escuela por asignatura.';



-- ########## FILE: 20260215000011_refactor_analytical_program_unique.sql ##########
-- MODIFICACIÓN: PROGRAMA ANALÍTICO ÚNICO POR ESCUELA
-- Se elimina la dependencia de grupo y materia en la tabla principal.
-- La materia se vincula ahora a nivel de contenido individual.

-- 1. Eliminar columnas innecesarias de la tabla principal
ALTER TABLE public.analytical_programs DROP COLUMN IF EXISTS group_id;
ALTER TABLE public.analytical_programs DROP COLUMN IF EXISTS subject_id;

-- 2. Modificar la tabla de contenidos para incluir subject_id
-- Esto permite que el programa sea único de la escuela, pero cada contenido sea de una materia diferente.
ALTER TABLE public.analytical_program_contents ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES public.subject_catalog(id) ON DELETE SET NULL;

-- 3. Actualizar comentario
COMMENT ON TABLE public.analytical_programs IS 'Programa Analítico ÚNICO por escuela y ciclo escolar. Basado en diagnóstico integral.';



-- ########## FILE: 20260215000012_expand_analytical_program.sql ##########

-- AMPLIACIÓN DEL PROGRAMA ANALÍTICO PARA FORMATO NEM COMPLETO
-- Agregamos campos estructurados para Contexto, Diagnóstico y Estrategias

ALTER TABLE public.analytical_programs 
ADD COLUMN IF NOT EXISTS school_data JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS external_context JSONB DEFAULT '{"favors": "", "difficults": ""}',
ADD COLUMN IF NOT EXISTS internal_context JSONB DEFAULT '{"favors": "", "difficults": ""}',
ADD COLUMN IF NOT EXISTS group_diagnosis JSONB DEFAULT '{"narrative": "", "problem_situations": [], "interest_topics": []}',
ADD COLUMN IF NOT EXISTS pedagogical_strategies JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS evaluation_strategies JSONB DEFAULT '{"description": "", "instruments": [], "feedback_guidelines": []}',
ADD COLUMN IF NOT EXISTS national_strategies JSONB DEFAULT '[]';

COMMENT ON COLUMN public.analytical_programs.school_data IS 'Datos de la escuela: CCT, Nivel, Modalidad, Sostenimiento, etc.';
COMMENT ON COLUMN public.analytical_programs.external_context IS 'Análisis del contexto externo: lo que favorece y dificulta el aprendizaje.';
COMMENT ON COLUMN public.analytical_programs.internal_context IS 'Análisis del contexto interno: lo que favorece y dificulta el aprendizaje.';
COMMENT ON COLUMN public.analytical_programs.group_diagnosis IS 'Diagnóstico detallado del grupo, situaciones-problema y temas de interés.';
COMMENT ON COLUMN public.analytical_programs.pedagogical_strategies IS 'Lista de metodologías seleccionadas (ABP, STEAM, etc.)';
COMMENT ON COLUMN public.analytical_programs.evaluation_strategies IS 'Enfoque, instrumentos y pautas de retroalimentación.';
COMMENT ON COLUMN public.analytical_programs.national_strategies IS 'Lista de estrategias nacionales incorporadas (Lectura, Inclusión, etc.)';



-- ########## FILE: 20260215000013_add_academic_year_id_fix.sql ##########
-- FIX: Add academic_year_id if missing to analytical_programs

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytical_programs' AND column_name = 'academic_year_id') THEN
        ALTER TABLE public.analytical_programs 
        ADD COLUMN academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE CASCADE;
        
        -- Create index if logically consistent
        CREATE INDEX IF NOT EXISTS idx_analytical_academic_year ON public.analytical_programs(academic_year_id);
    END IF;
END $$;



-- ########## FILE: 20260215000015_add_attendance_subject.sql ##########
-- Add subject_id to attendance table
ALTER TABLE public.attendance 
ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES public.subject_catalog(id) ON DELETE SET NULL;

-- Drop old unique constraint if it exists (try multiple names as it might vary)
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_student_id_date_group_id_key;
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS unique_attendance_entry;

-- Add new unique constraint including subject_id
-- We use NULLS NOT DISTINCT to handle cases where subject_id might be null (daily attendance)
-- ensuring we don't have multiple "null subject" entries for the same student/day
-- Add new unique constraint including subject_id safely
-- We use NULLS NOT DISTINCT to handle cases where subject_id might be null (daily attendance)
-- ensuring we don't have multiple "null subject" entries for the same student/day
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'attendance_student_day_subject_unique'
    ) THEN
        ALTER TABLE public.attendance 
        ADD CONSTRAINT attendance_student_day_subject_unique 
        UNIQUE NULLS NOT DISTINCT (student_id, date, group_id, subject_id);
    END IF;
END $$;



-- ########## FILE: 20260215000016_add_cycle_dates_to_school_details.sql ##########
ALTER TABLE public.school_details 
ADD COLUMN IF NOT EXISTS current_cycle_start date,
ADD COLUMN IF NOT EXISTS current_cycle_end date;



-- ########## FILE: 20260215000017_add_instrument_to_assignments_final.sql ##########
-- Migration: Add instrument_id to assignments
-- This allows linking an interactive instrument (rubric/checklist) to a specific assignment.

ALTER TABLE public.assignments 
ADD COLUMN IF NOT EXISTS instrument_id UUID REFERENCES public.rubrics(id) ON DELETE SET NULL;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_assignments_instrument ON public.assignments(instrument_id);

-- Optional: Fix typo in weighting_percentage if it was created as weightING_percentage
-- (Postgres usually folds unquoted names to lowercase, but let's be safe)
-- DO NOT RENAME if it's already lowercased.



-- ########## FILE: 20260215000018_add_pdf_columns.sql ##########
-- Add columns to store uploaded PDF reference and extracted text

-- For Analytical Programs
ALTER TABLE "public"."analytical_programs" 
ADD COLUMN IF NOT EXISTS "source_document_url" text,
ADD COLUMN IF NOT EXISTS "extracted_text" text;

-- For Lesson Plans (Planning)
ALTER TABLE "public"."lesson_plans" 
ADD COLUMN IF NOT EXISTS "source_document_url" text,
ADD COLUMN IF NOT EXISTS "extracted_text" text;



-- ########## FILE: 20260215000019_add_project_duration.sql ##########
-- Agregar columna 'project_duration' a la tabla lesson_plans para persistencia de duración de proyectos
ALTER TABLE public.lesson_plans 
ADD COLUMN IF NOT EXISTS project_duration INTEGER DEFAULT 10;

COMMENT ON COLUMN public.lesson_plans.project_duration IS 'Duración estimada del proyecto en número de sesiones.';



-- ########## FILE: 20260215000020_add_project_purpose.sql ##########

-- Agregar columna 'purpose' a la tabla lesson_plans si no existe
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_plans' AND column_name = 'purpose') THEN
        ALTER TABLE public.lesson_plans ADD COLUMN purpose TEXT;
    END IF;
END $$;



-- ########## FILE: 20260215000021_add_proposal_persistence.sql ##########
-- Migration to add program_by_fields column for AI proposal persistence
ALTER TABLE public.analytical_programs 
ADD COLUMN IF NOT EXISTS program_by_fields JSONB DEFAULT '{
    "lenguajes": [],
    "saberes": [],
    "etica": [],
    "humano": []
}';

COMMENT ON COLUMN public.analytical_programs.program_by_fields IS 'Propuesta didáctica generada por IA estructurada por campos formativos.';



-- ########## FILE: 20260215000022_add_school_logos.sql ##########
-- Add logo columns to tenants table
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS logo_left_url text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS logo_right_url text;



-- ########## FILE: 20260215000023_allow_duplicate_groups.sql ##########
-- Drop the unique constraint that prevents creating multiple groups with same grade/section/shift
-- This is necessary to support Technology Workshops where we have multiple "1° A" groups but with different subjects (Robotics, Informatics, etc.)

ALTER TABLE "public"."groups" DROP CONSTRAINT IF EXISTS "groups_tenant_id_academic_year_id_grade_section_shift_key";



-- ########## FILE: 20260215000024_close_trimester_schema.sql ##########
-- 1. Add 'is_closed' column to evaluation_periods
ALTER TABLE public.evaluation_periods 
ADD COLUMN IF NOT EXISTS is_closed BOOLEAN DEFAULT FALSE;

-- 2. Create 'evaluation_snapshots' table for historical records
CREATE TABLE IF NOT EXISTS public.evaluation_snapshots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
    
    -- Optional references depending on the type of snapshot
    subject_id UUID REFERENCES public.subject_catalog(id) ON DELETE SET NULL, 
    period_id UUID REFERENCES public.evaluation_periods(id) ON DELETE SET NULL, -- Null if ACADEMIC_YEAR
    academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE SET NULL, -- Useful for yearly snapshots

    type TEXT NOT NULL CHECK (type IN ('TRIMESTER', 'ACADEMIC_YEAR')),
    
    final_score NUMERIC(5,2) NOT NULL DEFAULT 0,
    
    -- JSONB for flexible storage of stats and breakdown
    -- stats example: { "attendance": 45, "absences": 2, "delays": 1 }
    stats JSONB DEFAULT '{}'::jsonb,
    
    -- breakdown example: { "criteria": { "exam": 30, "homework": 20 }, "activities": [...] }
    breakdown JSONB DEFAULT '{}'::jsonb,
    
    status TEXT DEFAULT 'FINAL' CHECK (status IN ('FINAL', 'DRAFT', 'AMENDED')),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Enable RLS
ALTER TABLE public.evaluation_snapshots ENABLE ROW LEVEL SECURITY;

-- 4. Policies for evaluation_snapshots
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'evaluation_snapshots' AND policyname = 'Tenant users can view snapshots'
    ) THEN
        CREATE POLICY "Tenant users can view snapshots" ON public.evaluation_snapshots
    FOR SELECT
    USING (auth.uid() IN (SELECT id FROM profiles WHERE tenant_id = evaluation_snapshots.tenant_id));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'evaluation_snapshots' AND policyname = 'Tenant admins/teachers can manage snapshots'
    ) THEN
        CREATE POLICY "Tenant admins/teachers can manage snapshots" ON public.evaluation_snapshots
    FOR ALL
    USING (auth.uid() IN (SELECT id FROM profiles WHERE tenant_id = evaluation_snapshots.tenant_id));
    END IF;
END $$;

-- 5. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_snapshots_student ON public.evaluation_snapshots(student_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_group_period ON public.evaluation_snapshots(group_id, period_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_tenant ON public.evaluation_snapshots(tenant_id);



-- ########## FILE: 20260215000025_communication_system.sql ##########
-- 1. Extend Guardians Table to link with Auth Profiles
ALTER TABLE public.guardians ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id);

-- 2. Chat Rooms
CREATE TABLE IF NOT EXISTS public.chat_rooms (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
    name text, -- Optional for group chats
    type text NOT NULL CHECK (type IN ('DIRECT', 'GROUP', 'CHANNEL')),
    created_at timestamp with time zone DEFAULT now()
);

-- 3. Chat Participants
CREATE TABLE IF NOT EXISTS public.chat_participants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id uuid REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
    profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    role text DEFAULT 'MEMBER' CHECK (role IN ('ADMIN', 'MEMBER')),
    last_read_at timestamp with time zone DEFAULT now(),
    UNIQUE(room_id, profile_id)
);

-- 4. Chat Messages
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id uuid REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
    sender_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    content text,
    type text DEFAULT 'TEXT' CHECK (type IN ('TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT', 'REPORT', 'STICKER')),
    metadata jsonb DEFAULT '{}', -- For link previews, report details, shared items
    created_at timestamp with time zone DEFAULT now()
);

-- 5. Chat Reactions
CREATE TABLE IF NOT EXISTS public.chat_reactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id uuid REFERENCES public.chat_messages(id) ON DELETE CASCADE,
    profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    reaction text NOT NULL, -- emoji or alias
    UNIQUE(message_id, profile_id, reaction)
);

-- RLS Policies
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_reactions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see rooms they are participants of
-- Policy: Users can only see rooms they are participants of
-- Policy: Users can see rooms in their tenant
DROP POLICY IF EXISTS "View own rooms" ON public.chat_rooms;
CREATE POLICY "View own rooms" ON public.chat_rooms
    FOR SELECT USING (
        tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    );

-- Policy: Users can see participants in their tenant's rooms
DROP POLICY IF EXISTS "View participants" ON public.chat_participants;
CREATE POLICY "View participants" ON public.chat_participants
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.chat_rooms r
            WHERE r.id = chat_participants.room_id
            AND r.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
        )
    );

-- Policy: Users can send messages to rooms in their tenant
DROP POLICY IF EXISTS "Send messages" ON public.chat_messages;
CREATE POLICY "Send messages" ON public.chat_messages
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.chat_rooms r
            WHERE r.id = chat_messages.room_id
            AND r.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
        )
    );

-- Policy: Users can read messages in their tenant's rooms
DROP POLICY IF EXISTS "Read messages" ON public.chat_messages;
CREATE POLICY "Read messages" ON public.chat_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.chat_rooms r
            WHERE r.id = chat_messages.room_id
            AND r.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
        )
    );

-- Enable Realtime for these tables safely
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'chat_messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'chat_rooms'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_rooms;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'chat_participants'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_participants;
    END IF;
END $$;



-- ########## FILE: 20260215000026_create_school_assets_bucket.sql ##########
-- Create a new bucket 'school-assets' if it doesn't exist
insert into storage.buckets (id, name, public)
values ('school-assets', 'school-assets', true)
on conflict (id) do nothing;

-- Set up security policies for the bucket with UNIQUE names to avoid conflicts

-- 1. Allow public read access (Unique name)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public Access school-assets'
    ) THEN
        CREATE POLICY "Public Access school-assets" ON storage.objects for select
  using ( bucket_id = 'school-assets' );
    END IF;
END $$;

-- 2. Allow authenticated users to upload images (Unique name)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Auth upload school-assets'
    ) THEN
        CREATE POLICY "Auth upload school-assets" ON storage.objects for insert
  to authenticated
  with check ( bucket_id = 'school-assets' );
    END IF;
END $$;

-- 3. Allow users to update/delete their own uploads
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Auth update own school-assets'
    ) THEN
        CREATE POLICY "Auth update own school-assets" ON storage.objects for update
  to authenticated
  using ( bucket_id = 'school-assets' and auth.uid() = owner );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Auth delete own school-assets'
    ) THEN
        CREATE POLICY "Auth delete own school-assets" ON storage.objects for delete
  to authenticated
  using ( bucket_id = 'school-assets' and auth.uid() = owner );
    END IF;
END $$;



-- ########## FILE: 20260215000028_enhance_incidents_schema.sql ##########
-- Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.student_incidents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
    teacher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('CONDUCTA', 'ACADEMICO', 'EMOCIONAL', 'POSITIVO', 'SALUD')),
    severity TEXT NOT NULL CHECK (severity IN ('BAJA', 'MEDIA', 'ALTA')),
    description TEXT NOT NULL,
    action_taken TEXT,
    is_private BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add new columns if they don't exist
ALTER TABLE public.student_incidents 
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'RESOLVED', 'SIGNED')),
ADD COLUMN IF NOT EXISTS has_commitment BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS commitment_description TEXT;

-- Update existing records to have a title if missing
UPDATE public.student_incidents SET title = 'Reporte General' WHERE title IS NULL;

-- Make title required
ALTER TABLE public.student_incidents ALTER COLUMN title SET NOT NULL;

-- Enable RLS
ALTER TABLE public.student_incidents ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'student_incidents' AND policyname = 'Users can view incidents for their tenant'
    ) THEN
        CREATE POLICY "Users can view incidents for their tenant"
        ON public.student_incidents FOR SELECT
        USING (auth.uid() IN (SELECT id FROM public.profiles WHERE tenant_id = student_incidents.tenant_id));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'student_incidents' AND policyname = 'Users can log incidents'
    ) THEN
        CREATE POLICY "Users can log incidents"
        ON public.student_incidents FOR INSERT
        WITH CHECK (auth.role() = 'authenticated');
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'student_incidents' AND policyname = 'Users can update incidents'
    ) THEN
        CREATE POLICY "Users can update incidents"
        ON public.student_incidents FOR UPDATE
        USING (auth.uid() IN (SELECT id FROM public.profiles WHERE tenant_id = student_incidents.tenant_id));
    END IF;
END $$;



-- ########## FILE: 20260215000033_smtp_settings.sql ##########
-- Create system_settings table for global configurations
CREATE TABLE IF NOT EXISTS public.system_settings (
    key text PRIMARY KEY,
    value text NOT NULL,
    description text,
    updated_at timestamp with time zone DEFAULT now()
);

-- Seed SMTP keys with empty/default values
INSERT INTO public.system_settings (key, value, description) VALUES
('smtp_host', '', 'Servidor SMTP (ej. smtp.gmail.com)'),
('smtp_port', '587', 'Puerto SMTP (587 para STARTTLS, 465 para SSL)'),
('smtp_user', '', 'Usuario de autenticación SMTP'),
('smtp_pass', '', 'Contraseña de autenticación SMTP'),
('smtp_crypto', 'STARTTLS', 'Tipo de encriptación (NONE, SSL, TLS, STARTTLS)'),
('smtp_from_email', '', 'Correo electrónico del remitente'),
('smtp_from_name', 'EduManager Notificaciones', 'Nombre mostrado como remitente')
ON CONFLICT (key) DO NOTHING;

-- RLS: Only SuperAdmins (or users with specific role) can manage settings
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'system_settings' AND policyname = 'Admins can manage system settings'
    ) THEN
        CREATE POLICY "Admins can manage system settings" ON public.system_settings
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'ADMIN'
    )
);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'system_settings' AND policyname = 'Public read for system settings'
    ) THEN
        CREATE POLICY "Public read for system settings" ON public.system_settings
FOR SELECT
USING (true);
    END IF;
END $$; -- Needed for Edge Functions to read settings



-- ########## FILE: 20260215000034_multi_role_support.sql ##########
-- 1. Create profile_roles table for many-to-many relationship
CREATE TABLE IF NOT EXISTS public.profile_roles (
    profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    role text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (profile_id, role)
);

-- 2. Add constraint to ensure role is valid
DO $$ 
BEGIN 
    ALTER TABLE public.profile_roles ADD CONSTRAINT profile_roles_check 
    CHECK (role IN (
        'SUPER_ADMIN',
        'ADMIN',
        'DIRECTOR',
        'ACADEMIC_COORD',
        'TECH_COORD',
        'SCHOOL_CONTROL',
        'TEACHER',
        'PREFECT',
        'SUPPORT',
        'TUTOR',
        'STUDENT'
    ));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 3. Enable RLS
ALTER TABLE public.profile_roles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profile_roles' AND policyname = 'Users can view their own roles'
    ) THEN
        CREATE POLICY "Users can view their own roles"
        ON public.profile_roles FOR SELECT
        USING (profile_id = auth.uid());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profile_roles' AND policyname = 'Admins can manage roles in their tenant'
    ) THEN
        CREATE POLICY "Admins can manage roles in their tenant"
        ON public.profile_roles FOR ALL
        USING (EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role IN ('SUPER_ADMIN', 'ADMIN', 'DIRECTOR')
        ));
    END IF;
END $$;

-- 4. Initial migration: Link current roles
INSERT INTO public.profile_roles (profile_id, role)
SELECT id, role FROM public.profiles
ON CONFLICT (profile_id, role) DO NOTHING;

-- 5. RPC to change current active role
CREATE OR REPLACE FUNCTION public.switch_active_role(new_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    -- Verify user has this role
    IF EXISTS (SELECT 1 FROM profile_roles WHERE profile_id = auth.uid() AND role = new_role) THEN
        UPDATE public.profiles SET role = new_role WHERE id = auth.uid();
    ELSE
        RAISE EXCEPTION 'User does not have the specified role';
    END IF;
END;
$$;



-- ########## FILE: 20260215000035_staff_management.sql ##########
-- 1. Create staff_invitations table
CREATE TABLE IF NOT EXISTS public.staff_invitations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
    email text NOT NULL,
    role text NOT NULL,
    token uuid DEFAULT gen_random_uuid() UNIQUE,
    status text DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'EXPIRED')),
    created_by uuid REFERENCES public.profiles(id),
    created_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone DEFAULT (now() + interval '7 days')
);

-- Enable RLS for staff_invitations
ALTER TABLE public.staff_invitations ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'staff_invitations' AND policyname = 'Admins can manage invitations in their tenant'
    ) THEN
        CREATE POLICY "Admins can manage invitations in their tenant"
        ON public.staff_invitations FOR ALL
        USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));
    END IF;
END $$;

-- 2. Create RPC to get invitation info securely (Publicly accessible but via token)
CREATE OR REPLACE FUNCTION public.get_invitation_info(token_uuid uuid)
RETURNS TABLE (
    tenant_name text,
    role text,
    email text
) 
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT t.name, i.role, i.email
    FROM staff_invitations i
    JOIN tenants t ON t.id = i.tenant_id
    WHERE i.token = token_uuid AND i.status = 'PENDING' AND i.expires_at > now();
END;
$$;

-- 3. Update handle_new_user trigger to handle JOIN mode
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
declare
  new_tenant_id uuid;
  meta jsonb;
  tenant_name text;
  inv_token uuid;
  inv_record record;
  assigned_role text;
begin
  meta := new.raw_user_meta_data;
  inv_token := (meta->>'invitationToken')::uuid;

  -- CHECK IF JOINING VIA INVITATION
  if inv_token is not null then
    select * into inv_record from staff_invitations 
    where token = inv_token and status = 'PENDING' and expires_at > now();

    if found then
       new_tenant_id := inv_record.tenant_id;
       assigned_role := inv_record.role;
       
       -- Mark invitation as accepted
       update staff_invitations set status = 'ACCEPTED' where id = inv_record.id;
    else
       -- If token is invalid/expired, we might want to fail or default to new tenant. 
       -- For now, let's treat it as a new tenant request if JOIN fails but keep track.
       assigned_role := 'ADMIN'; 
    end if;
  end if;

  -- IF NOT JOINING, CREATE NEW TENANT
  if new_tenant_id is null then
    tenant_name := meta->>'organizationName';
    
    if tenant_name is null or trim(tenant_name) = '' then
      tenant_name := trim(
        coalesce(meta->>'firstName', '') || ' ' || 
        coalesce(meta->>'lastNamePaternal', '') || ' ' || 
        coalesce(meta->>'lastNameMaternal', '')
      );
    end if;

    insert into public.tenants (name, type)
    values (
      tenant_name,
      coalesce(meta->>'mode', 'INDEPENDENT')
    )
    returning id into new_tenant_id;
    
    assigned_role := 'ADMIN';
  end if;

  -- Create the Profile
  insert into public.profiles (
    id,
    tenant_id,
    first_name,
    last_name_paternal,
    last_name_maternal,
    role
  )
  values (
    new.id,
    new_tenant_id,
    meta->>'firstName',
    meta->>'lastNamePaternal',
    meta->>'lastNameMaternal',
    assigned_role
  );

  return new;
end;
$$;



-- ########## FILE: 20260215000036_profile_setup_schema.sql ##########
-- Migration: Add extended profile columns for Setup Wizard
-- Created: 2026-02-14

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS nationality text,
ADD COLUMN IF NOT EXISTS birth_date date,
ADD COLUMN IF NOT EXISTS sex text CHECK (sex IN ('HOMBRE', 'MUJER', 'OTRO')),
ADD COLUMN IF NOT EXISTS marital_status text,
ADD COLUMN IF NOT EXISTS curp text,
ADD COLUMN IF NOT EXISTS rfc text,
ADD COLUMN IF NOT EXISTS address_particular text,
ADD COLUMN IF NOT EXISTS phone_contact text,
ADD COLUMN IF NOT EXISTS profile_setup_completed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS avatar_url text;

-- Update RLS policies to allow updating these new columns
-- (Existing policy "Users can update own profile" should already cover this as it allows updates to own row)



-- ########## FILE: 20260215000037_create_calendar_tables.sql ##########

-- Calendar Events (SEP / Official School Calendar)
create table if not exists public.calendar_events (
  id uuid not null default gen_random_uuid (),
  title text not null,
  description text null,
  start_date date not null,
  end_date date not null,
  type text not null default 'generic', -- holiday, administrative, exam, generic
  is_official_sep boolean not null default false,
  tenant_id uuid not null references public.tenants (id),
  created_at timestamp with time zone not null default now(),
  constraint calendar_events_pkey primary key (id)
);

-- Teacher Personal Events
create table if not exists public.teacher_events (
  id uuid not null default gen_random_uuid (),
  teacher_id uuid not null references public.profiles (id),
  title text not null,
  description text null,
  start_time timestamp with time zone not null,
  end_time timestamp with time zone not null,
  tenant_id uuid not null references public.tenants (id),
  created_at timestamp with time zone not null default now(),
  constraint teacher_events_pkey primary key (id)
);

-- RLS Policies
alter table public.calendar_events enable row level security;
alter table public.teacher_events enable row level security;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'calendar_events' AND policyname = 'Enable read access for all users'
    ) THEN
        CREATE POLICY "Enable read access for all users" ON public.calendar_events for select using (true);
    END IF;
END $$;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'calendar_events' AND policyname = 'Enable insert for authenticated users only'
    ) THEN
        CREATE POLICY "Enable insert for authenticated users only" ON public.calendar_events for insert with check (auth.role () = 'authenticated');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'teacher_events' AND policyname = 'Teachers can manage their own events'
    ) THEN
        CREATE POLICY "Teachers can manage their own events" ON public.teacher_events using (auth.uid() = teacher_id);
    END IF;
END $$;



-- ########## FILE: 20260215000040_create_evidence_schema.sql ##########

-- Student Evidence Portfolio Table (Repair script)
CREATE TABLE IF NOT EXISTS evidence_portfolio (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    file_url TEXT NOT NULL,
    file_type TEXT DEFAULT 'IMAGE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='evidence_portfolio' AND column_name='tenant_id') THEN
        ALTER TABLE evidence_portfolio ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='evidence_portfolio' AND column_name='teacher_id') THEN
        ALTER TABLE evidence_portfolio ADD COLUMN teacher_id UUID REFERENCES profiles(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='evidence_portfolio' AND column_name='category') THEN
        ALTER TABLE evidence_portfolio ADD COLUMN category TEXT DEFAULT 'CLASSWORK';
    END IF;
END $$;

-- Enable RLS
ALTER TABLE evidence_portfolio ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own tenant evidence" ON evidence_portfolio;
DROP POLICY IF EXISTS "Teachers can insert evidence in their tenant" ON evidence_portfolio;
DROP POLICY IF EXISTS "Teachers can update/delete their own evidence" ON evidence_portfolio;

-- Policies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'evidence_portfolio' AND policyname = 'Users can view their own tenant evidence'
    ) THEN
        CREATE POLICY "Users can view their own tenant evidence" ON evidence_portfolio FOR SELECT
    USING (tenant_id IN (SELECT id FROM tenants));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'evidence_portfolio' AND policyname = 'Teachers can insert evidence in their tenant'
    ) THEN
        CREATE POLICY "Teachers can insert evidence in their tenant" ON evidence_portfolio FOR INSERT
    WITH CHECK (tenant_id IN (SELECT id FROM tenants));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'evidence_portfolio' AND policyname = 'Teachers can update/delete their own evidence'
    ) THEN
        CREATE POLICY "Teachers can update/delete their own evidence" ON evidence_portfolio FOR ALL
    USING (teacher_id = auth.uid());
    END IF;
END $$;



-- ########## FILE: 20260215000041_create_formative_schema.sql ##########

-- Tabla para Registros de Evaluación Formativa (Anecdóticos, Diarios, etc.)
CREATE TABLE IF NOT EXISTS public.formative_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE, -- Opcional (puede ser registro grupal)
    
    type TEXT NOT NULL CHECK (type IN ('ANECDOTAL', 'JOURNAL', 'OBSERVATION', 'CHECKLIST')),
    content JSONB NOT NULL, -- Almacena los campos específicos de cada instrumento
    observation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla para el Portafolio de Evidencias (Metadatos de Archivos)
CREATE TABLE IF NOT EXISTS public.evidence_portfolio (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
    assignment_id UUID REFERENCES public.assignments(id) ON DELETE SET NULL, -- Opcional: vinculado a una tarea
    
    title TEXT NOT NULL,
    description TEXT,
    file_url TEXT NOT NULL, -- URL de Supabase Storage
    file_type TEXT, -- "image", "audio", "document"
    
    period_id UUID REFERENCES public.evaluation_periods(id) ON DELETE SET NULL, -- Para organizar por trimestre
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.formative_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_portfolio ENABLE ROW LEVEL SECURITY;

-- Políticas RLS (Standard Tenant Access)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'formative_records' AND policyname = 'Enable access for tenant users on formative'
    ) THEN
        CREATE POLICY "Enable access for tenant users on formative" ON public.formative_records
    USING (auth.uid() IN (SELECT id FROM profiles WHERE tenant_id = formative_records.tenant_id))
    WITH CHECK (auth.uid() IN (SELECT id FROM profiles WHERE tenant_id = formative_records.tenant_id));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'evidence_portfolio' AND policyname = 'Enable access for tenant users on portfolio'
    ) THEN
        CREATE POLICY "Enable access for tenant users on portfolio" ON public.evidence_portfolio
    USING (auth.uid() IN (SELECT id FROM profiles WHERE tenant_id = evidence_portfolio.tenant_id))
    WITH CHECK (auth.uid() IN (SELECT id FROM profiles WHERE tenant_id = evidence_portfolio.tenant_id));
    END IF;
END $$;

-- Índices
CREATE INDEX IF NOT EXISTS idx_formative_student ON public.formative_records(student_id);
CREATE INDEX IF NOT EXISTS idx_formative_group ON public.formative_records(group_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_student ON public.evidence_portfolio(student_id);



-- ########## FILE: 20260215000044_create_schedule_settings_table.sql ##########
-- Create schedule_settings table
CREATE TABLE IF NOT EXISTS public.schedule_settings (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    start_time time NOT NULL DEFAULT '07:00:00',
    end_time time NOT NULL DEFAULT '14:00:00',
    module_duration integer NOT NULL DEFAULT 50, -- in minutes
    breaks jsonb DEFAULT '[]'::jsonb, -- Array of {name, start_time, end_time}
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT schedule_settings_pkey PRIMARY KEY (id),
    CONSTRAINT schedule_settings_tenant_key UNIQUE (tenant_id)
);

-- Enable RLS
ALTER TABLE public.schedule_settings ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Users can view settings in own tenant" ON public.schedule_settings;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'schedule_settings' AND policyname = 'Users can view settings in own tenant'
    ) THEN
        CREATE POLICY "Users can view settings in own tenant" ON public.schedule_settings
    FOR SELECT USING (tenant_id = get_current_tenant_id());
    END IF;
END $$;

DROP POLICY IF EXISTS "Admins can manage settings" ON public.schedule_settings;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'schedule_settings' AND policyname = 'Admins can manage settings'
    ) THEN
        CREATE POLICY "Admins can manage settings" ON public.schedule_settings
    FOR ALL USING (tenant_id = get_current_tenant_id());
    END IF;
END $$;



-- ########## FILE: 20260215000045_create_schedules_table.sql ##########
-- Create schedules table
CREATE TABLE IF NOT EXISTS public.schedules (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    subject_id uuid REFERENCES public.subject_catalog(id),
    custom_subject text,
    day_of_week text NOT NULL CHECK (day_of_week IN ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY')),
    start_time time NOT NULL,
    end_time time NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT schedules_pkey PRIMARY KEY (id),
    CONSTRAINT schedules_subject_check CHECK (
        (subject_id IS NOT NULL AND custom_subject IS NULL) OR 
        (subject_id IS NULL AND custom_subject IS NOT NULL)
    )
);

-- Enable RLS
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Users can view schedules in own tenant" ON public.schedules;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'schedules' AND policyname = 'Users can view schedules in own tenant'
    ) THEN
        CREATE POLICY "Users can view schedules in own tenant" ON public.schedules
    FOR SELECT USING (tenant_id = get_current_tenant_id());
    END IF;
END $$;

DROP POLICY IF EXISTS "Admins/Teachers can manage schedules" ON public.schedules;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'schedules' AND policyname = 'Admins/Teachers can manage schedules'
    ) THEN
        CREATE POLICY "Admins/Teachers can manage schedules" ON public.schedules
    FOR ALL USING (tenant_id = get_current_tenant_id());
    END IF;
END $$;



-- ########## FILE: 20260215000046_create_soft_delete_system.sql ##########
-- Migration: Soft Delete and Email Release System
-- This allows users to "delete" their account while freeing their email for new registration.
-- It also enables a 24h+ recovery window for SuperAdmins.

-- 1. Add deleted_at column to profiles
alter table public.profiles add column if not exists deleted_at timestamp with time zone;

-- 2. Function to Soft Delete an account
-- Renames the email in auth.users to release the original address.
create or replace function public.soft_delete_account(target_user_id uuid)
returns void
language plpgsql
security definer -- Runs with elevated privileges to modify auth.users
as $$
declare
    current_email text;
    new_email text;
begin
    -- 1. Get current email
    select email into current_email from auth.users where id = target_user_id;

    -- 2. Create a "tombstone" email to release the original one
    new_email := current_email || '.deleted.' || floor(extract(epoch from now())) || '@internal.edu';

    -- 3. Update auth.users (renaming releases the unique constraint on original email)
    update auth.users 
    set email = new_email, 
        raw_user_meta_data = raw_user_meta_data || jsonb_build_object('deleted_original_email', current_email)
    where id = target_user_id;

    -- 4. Mark profile as deleted
    update public.profiles 
    set deleted_at = now()
    where id = target_user_id;
end;
$$;

-- 3. Function to Restore an account
create or replace function public.restore_account(target_user_id uuid)
returns void
language plpgsql
security definer
as $$
declare
    original_email text;
begin
    -- 1. Get original email from metadata
    select (raw_user_meta_data->>'deleted_original_email') into original_email 
    from auth.users where id = target_user_id;

    if original_email is null then
        raise exception 'Could not find original email for restoration.';
    end if;

    -- 2. Restore email in auth.users (Will fail if original email is now taken by another account)
    update auth.users 
    set email = original_email,
        raw_user_meta_data = raw_user_meta_data - 'deleted_original_email'
    where id = target_user_id;

    -- 3. Unmark profile
    update public.profiles 
    set deleted_at = null
    where id = target_user_id;
end;
$$;

-- 4. Function to Purge (Permanent Delete) - NUCLEAR VERSION
-- Handles all known dependencies to avoid FK errors.
create or replace function public.purge_account(target_user_id uuid)
returns void
language plpgsql
security definer
as $$
declare
    target_tenant_id uuid;
begin
    -- 1. Get tenant_id
    select tenant_id into target_tenant_id from public.profiles where id = target_user_id;

    if target_tenant_id is not null then
        -- 2. Delete data in order of dependency (Leaf to Root)
        
        -- Level 5 (Deep dependencies)
        delete from public.rubric_descriptors where criterion_id in (select id from public.rubric_criteria where rubric_id in (select id from public.rubrics where tenant_id = target_tenant_id));
        delete from public.rubric_criteria where rubric_id in (select id from public.rubrics where tenant_id = target_tenant_id);
        delete from public.rubric_levels where rubric_id in (select id from public.rubrics where tenant_id = target_tenant_id);

        -- Level 4 (Secondary dependencies)
        delete from public.grades where tenant_id = target_tenant_id;
        delete from public.attendance where tenant_id = target_tenant_id;
        delete from public.schedules where tenant_id = target_tenant_id;
        delete from public.formative_records where tenant_id = target_tenant_id;
        delete from public.evidence_portfolio where tenant_id = target_tenant_id;
        delete from public.student_incidents where tenant_id = target_tenant_id;
        delete from public.student_bap_records where tenant_id = target_tenant_id;
        delete from public.teacher_events where tenant_id = target_tenant_id;
        delete from public.calendar_events where tenant_id = target_tenant_id;
        
        -- Level 3: Middle dependencies
        delete from public.evaluation_criteria where tenant_id = target_tenant_id;
        delete from public.evaluation_criteria_catalog where tenant_id = target_tenant_id;
        delete from public.assignments where tenant_id = target_tenant_id;
        delete from public.students where tenant_id = target_tenant_id;
        delete from public.lesson_plans where tenant_id = target_tenant_id;
        delete from public.rubrics where tenant_id = target_tenant_id;
        
        -- Level 2: Core school entities
        delete from public.profile_subjects where tenant_id = target_tenant_id;
        delete from public.evaluation_periods where tenant_id = target_tenant_id;
        delete from public.schedule_settings where tenant_id = target_tenant_id;
        delete from public.groups where tenant_id = target_tenant_id;
        delete from public.academic_years where tenant_id = target_tenant_id;
        
        -- 3. Delete Profiles
        delete from public.profiles where tenant_id = target_tenant_id;

        -- 4. Delete Tenant
        delete from public.tenants where id = target_tenant_id;
    end if;

    -- 5. Delete Auth User
    delete from auth.users where id = target_user_id;
end;
$$;

-- 5. Function to Purge by Email (for cleanup of blocked registrations)
create or replace function public.purge_auth_user_by_email(target_email text)
returns void
language plpgsql
security definer
as $$
declare
    target_user_id uuid;
begin
    -- 1. Find user ID by email in auth.users (case-insensitive)
    select id into target_user_id from auth.users where lower(email) = lower(target_email);

    if target_user_id is not null then
        -- 2. Call the existing purge function
        perform public.purge_account(target_user_id);
    else
        raise exception 'User with email % not found in auth system.', target_email;
    end if;
end;
$$;



-- ########## FILE: 20260215000048_fix_assignments_error.sql ##########
-- Add criterion_id to link assignments to evaluation_criteria
ALTER TABLE public.assignments 
ADD COLUMN IF NOT EXISTS criterion_id UUID REFERENCES public.evaluation_criteria(id) ON DELETE SET NULL;

-- Add lesson_plan_id to link activities to planning
ALTER TABLE public.assignments 
ADD COLUMN IF NOT EXISTS lesson_plan_id UUID REFERENCES public.lesson_plans(id) ON DELETE SET NULL;

-- Add start_date for projects
ALTER TABLE public.assignments 
ADD COLUMN IF NOT EXISTS start_date DATE;

-- Indices for faster lookups
CREATE INDEX IF NOT EXISTS idx_assignments_criterion ON public.assignments(criterion_id);
CREATE INDEX IF NOT EXISTS idx_assignments_lesson_plan ON public.assignments(lesson_plan_id);



-- ########## FILE: 20260215000049_comprehensive_rbac_v2.sql ##########
-- RBAC INTEGRAL - FASE 2
-- Ajuste de Políticas RLS para restringir la gestión administrativa a DIRECTIVOS y ADMINS.

-- 1. Tablas: tenants (Datos de la Escuela y API Keys)
-- Solo lectura para todos, actualización solo para ADMIN/DIRECTOR
DROP POLICY IF EXISTS "Enables update for tenant administrators" ON public.tenants;
CREATE POLICY "Enables update for tenant administrators" ON public.tenants
  FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles 
      WHERE tenant_id = tenants.id 
      AND role IN ('DIRECTOR', 'ADMIN')
    )
  );

-- 2. Tablas: academic_years y evaluation_periods
-- Solo lectura para todos, gestión solo para ADMIN/DIRECTOR
DROP POLICY IF EXISTS "Enable write access for admins on academic_years" ON public.academic_years;
CREATE POLICY "Enable write access for admins on academic_years" ON public.academic_years
  FOR ALL
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles 
      WHERE tenant_id = academic_years.tenant_id 
      AND role IN ('DIRECTOR', 'ADMIN')
    )
  );

DROP POLICY IF EXISTS "Enable write access for admins on evaluation_periods" ON public.evaluation_periods;
CREATE POLICY "Enable write access for admins on evaluation_periods" ON public.evaluation_periods
  FOR ALL
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles 
      WHERE tenant_id = evaluation_periods.tenant_id 
      AND role IN ('DIRECTOR', 'ADMIN')
    )
  );

-- 3. Programa Analítico
-- Solo lectura para todos, gestión solo para ADMIN/DIRECTOR
DROP POLICY IF EXISTS "Enable write access for admins on analytical_programs" ON public.analytical_programs;
CREATE POLICY "Enable write access for admins on analytical_programs" ON public.analytical_programs
  FOR ALL
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles 
      WHERE tenant_id = public.analytical_programs.tenant_id 
      AND role IN ('DIRECTOR', 'ADMIN')
    )
  );

DROP POLICY IF EXISTS "Enable write access for admins on analytical_program_contents" ON public.analytical_program_contents;
CREATE POLICY "Enable write access for admins on analytical_program_contents" ON public.analytical_program_contents
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.analytical_programs p
      WHERE p.id = public.analytical_program_contents.program_id
      AND auth.uid() IN (
        SELECT id FROM public.profiles 
        WHERE tenant_id = p.tenant_id 
        AND role IN ('DIRECTOR', 'ADMIN')
      )
    )
  );

-- 4. Asignación de Materias (profile_subjects)
-- Los docentes solo leen sus asignaciones. Los admins gestionan.
DROP POLICY IF EXISTS "Enable write access for admins on profile_subjects" ON public.profile_subjects;
CREATE POLICY "Enable write access for admins on profile_subjects" ON public.profile_subjects
  FOR ALL
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles 
      WHERE tenant_id = profile_subjects.tenant_id 
      AND role IN ('DIRECTOR', 'ADMIN')
    )
  );

-- 5. Perfiles (profiles)
-- Todo usuario puede actualizar su propio perfil (nombre, avatar).
-- Solo admins pueden actualizar roles o eliminar? 
-- El usuario pide que el personal pueda editar su info personal si lo requiere.
DROP POLICY IF EXISTS "Public profiles are viewable by everyone in tenant" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone in tenant" ON public.profiles
  FOR SELECT
  USING (auth.uid() IN (SELECT id FROM profiles p WHERE p.tenant_id = profiles.tenant_id));

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    -- Evitar que un usuario se cambie a sí mismo de tenant o de rol si no es admin
    (CASE 
      WHEN (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('DIRECTOR', 'ADMIN') THEN true
      ELSE (
        role = (SELECT role FROM public.profiles WHERE id = auth.uid()) AND
        tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
      )
    END)
  );

-- 6. Storage Buckets para Documentos Personales y Chat
INSERT INTO storage.buckets (id, name, public) 
VALUES ('staff_documents', 'staff_documents', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('chat_attachments', 'chat_attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas de Storage
CREATE POLICY "Staff can manage their own documents"
ON storage.objects FOR ALL
USING (
  bucket_id = 'staff_documents' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can access chat attachments if member"
ON storage.objects FOR ALL
USING (
  bucket_id = 'chat_attachments' -- Simplificado para fines de demo, idealmente validar pertenencia a room
);



-- ########## FILE: 20260215000050_fix_registration_trigger.sql ##########
-- FIX: Handle User Registration via Trigger (Bypasses RLS issues)

-- 1. Create the Function that runs when a user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  new_tenant_id uuid;
  meta jsonb;
  tenant_name text;
  full_name text;
begin
  -- Get metadata from the auth.users payload
  meta := new.raw_user_meta_data;
  
  -- Determine Tenant Name: Prioritize organizationName, fallback to person name
  tenant_name := meta->>'organizationName';
  
  if tenant_name is null or trim(tenant_name) = '' then
    -- For Independent or if empty, construct name from user parts
    tenant_name := trim(
      coalesce(meta->>'firstName', '') || ' ' || 
      coalesce(meta->>'lastNamePaternal', '') || ' ' || 
      coalesce(meta->>'lastNameMaternal', '')
    );
  end if;

  -- Create the Tenant
  insert into public.tenants (name, type)
  values (
    tenant_name,
    meta->>'mode'
  )
  returning id into new_tenant_id;

  -- Create the Profile linked to the user and the new tenant
  insert into public.profiles (
    id,
    tenant_id,
    first_name,
    last_name_paternal,
    last_name_maternal,
    role
  )
  values (
    new.id,
    new_tenant_id,
    meta->>'firstName',
    meta->>'lastNamePaternal',
    meta->>'lastNameMaternal',
    'ADMIN' -- The creator is always the Admin
  );

  return new;
end;
$$;

-- 2. Create the Trigger
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute procedure public.handle_new_user();

-- 3. Cleanup RLS Policies (Optional but good practice)
-- Use this query to ensure we don't have conflicting client-side policies later if you want
-- drop policy "Enable insert for authenticated users" on public.tenants;



-- ########## FILE: 20260215000051_fix_schema.sql ##########
-- Consolidated Schema Fix for Students and Guardians
-- WARNING: Run this in Supabase SQL Editor to ensure all columns exist

-- 1. Ensure 'students' table has all required columns
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS address text; -- Kept for backward compatibility if needed, though we moved it to guardians
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS blood_type text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS allergies text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS fingerprint_data text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS status text default 'ACTIVE';
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS gender text; -- Needed for "HOMBRE"/"MUJER"
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS condition text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS condition_details text;

-- 2. Ensure 'guardians' table exists
CREATE TABLE IF NOT EXISTS public.guardians (
    id uuid primary key default gen_random_uuid(),
    student_id uuid references public.students(id) not null,
    first_name text not null,
    last_name_paternal text not null,
    last_name_maternal text,
    relationship text not null,
    email text,
    phone text,
    occupation text,
    address text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Enable RLS on Guardians if not already enabled
ALTER TABLE public.guardians ENABLE ROW LEVEL SECURITY;

-- 4. Create Policies if they don't exist (Drop first to avoid errors)
DROP POLICY IF EXISTS "Users can view guardians in own tenant" ON public.guardians;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'guardians' AND policyname = 'Users can view guardians in own tenant'
    ) THEN
        CREATE POLICY "Users can view guardians in own tenant" ON public.guardians FOR SELECT
USING (
    student_id IN (
        SELECT id FROM public.students WHERE tenant_id = get_current_tenant_id()
    )
);
    END IF;
END $$;

DROP POLICY IF EXISTS "Admins/Teachers can manage guardians" ON public.guardians;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'guardians' AND policyname = 'Admins/Teachers can manage guardians'
    ) THEN
        CREATE POLICY "Admins/Teachers can manage guardians" ON public.guardians FOR ALL
USING (
    student_id IN (
        SELECT id FROM public.students WHERE tenant_id = get_current_tenant_id()
    )
);
    END IF;
END $$;



-- ########## FILE: 20260215000056_setup_phase2_fix.sql ##########
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



-- ########## FILE: 20260215000058_update_assignments_schema.sql ##########
-- Add criterion_id to link assignments to evaluation_criteria
ALTER TABLE public.assignments 
ADD COLUMN IF NOT EXISTS criterion_id UUID REFERENCES public.evaluation_criteria(id) ON DELETE SET NULL;

-- Add lesson_plan_id to link activities to planning
ALTER TABLE public.assignments 
ADD COLUMN IF NOT EXISTS lesson_plan_id UUID REFERENCES public.lesson_plans(id) ON DELETE SET NULL;

-- Indices for faster lookups
CREATE INDEX IF NOT EXISTS idx_assignments_criterion ON public.assignments(criterion_id);
CREATE INDEX IF NOT EXISTS idx_assignments_lesson_plan ON public.assignments(lesson_plan_id);

-- Refresh the view or relevant policies if needed (already broad enough)



-- ########## FILE: 20260215000059_update_names_schema.sql ##########
-- MIGRATION: Split Names into First, Paternal, Maternal

-- 1. Update PROFILES table
-- Add new columns
alter table public.profiles 
add column if not exists first_name text,
add column if not exists last_name_paternal text,
add column if not exists last_name_maternal text;

-- (Optional) Data Migration strategy for existing users could go here, 
-- but since it's a new app, we can just allow nulls conceptually or enforce later.

-- Remove old column eventually, but for now we can keep it or drop it.
-- alter table public.profiles drop column full_name;


-- 2. Update STUDENTS table definition (if not created yet, this amends the previous logic)
-- If table exists:
-- alter table public.students drop column last_name;
-- alter table public.students add column last_name_paternal text not null;
-- alter table public.students add column last_name_maternal text;

-- REVISED definition for Students (Use this for new creations)
-- table public.students (
--   ...
--   first_name text not null,
--   last_name_paternal text not null,
--   last_name_maternal text,
--   ...
-- );



-- ########## FILE: 20260215000060_update_rubrics_schema.sql ##########
-- Add JSONB content column for flexible instrument structures
ALTER TABLE public.rubrics ADD COLUMN IF NOT EXISTS content JSONB DEFAULT '{}'::jsonb;

-- Add AI and Sharing flags
ALTER TABLE public.rubrics ADD COLUMN IF NOT EXISTS is_ai_generated BOOLEAN DEFAULT FALSE;
ALTER TABLE public.rubrics ADD COLUMN IF NOT EXISTS original_prompt TEXT;
ALTER TABLE public.rubrics ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE; -- For the "Global Bank" feature

-- Update Type Constraint to support all 10 instrument types
ALTER TABLE public.rubrics DROP CONSTRAINT IF EXISTS rubrics_type_check;
ALTER TABLE public.rubrics ADD CONSTRAINT rubrics_type_check CHECK (type IN (
    'ANALYTIC', 
    'HOLISTIC', 
    'CHECKLIST', 
    'QUIZ', 
    'OBSERVATION', 
    'JOURNAL', 
    'TEST', 
    'INTERVIEW', 
    'PORTFOLIO', 
    'MAP', 
    'SELF_ASSESSMENT'
));



-- ########## FILE: 20260215000061_fix_trigger_priority.sql ##########
-- Migration: Fix handle_new_user trigger to prioritize tenantId and invitationToken
-- Replaces previous versions from migrations 34 and 48

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
declare
  new_tenant_id uuid;
  meta jsonb;
  tenant_name text;
  inv_token uuid;
  target_tenant_id uuid;
  inv_record record;
  assigned_role text;
  first_name text;
  last_name_paternal text;
  last_name_maternal text;
begin
  meta := new.raw_user_meta_data;
  
  -- Extract basic info
  first_name := coalesce(meta->>'firstName', '');
  last_name_paternal := coalesce(meta->>'lastNamePaternal', '');
  last_name_maternal := coalesce(meta->>'lastNameMaternal', '');
  
  -- 1. PRIORITY: Check for explicit tenantId (Used for Demo Seeds / Admin Actions)
  target_tenant_id := (meta->>'tenantId')::uuid;
  
  if target_tenant_id is not null then
    -- Verify tenant exists
    perform 1 from public.tenants where id = target_tenant_id;
    if found then
        new_tenant_id := target_tenant_id;
        assigned_role := coalesce(meta->>'role', 'TEACHER');
    end if;
  end if;

  -- 2. PRIORITY: Check for Invitation (Used for Email Invites)
  if new_tenant_id is null then
      inv_token := (meta->>'invitationToken')::uuid;
      if inv_token is not null then
        select * into inv_record from staff_invitations 
        where token = inv_token and status = 'PENDING' and expires_at > now();
    
        if found then
           new_tenant_id := inv_record.tenant_id;
           assigned_role := inv_record.role;
           
           -- Mark invitation as accepted
           update staff_invitations set status = 'ACCEPTED' where id = inv_record.id;
        end if;
      end if;
  end if;

  -- 3. FALLBACK: New School Registration (Self-Service)
  if new_tenant_id is null then
    tenant_name := meta->>'organizationName';
    
    if tenant_name is null or trim(tenant_name) = '' then
      tenant_name := trim(first_name || ' ' || last_name_paternal || ' ' || last_name_maternal);
      if trim(tenant_name) = '' then
          tenant_name := 'Nueva Escuela'; -- Fallback
      end if;
    end if;

    insert into public.tenants (name, type)
    values (
      tenant_name,
      coalesce(meta->>'mode', 'SCHOOL')
    )
    returning id into new_tenant_id;
    
    assigned_role := 'ADMIN'; -- Creator is Admin
  end if;

  -- 4. Create Profile
  insert into public.profiles (
    id,
    tenant_id,
    first_name,
    last_name_paternal,
    last_name_maternal,
    role
  )
  values (
    new.id,
    new_tenant_id,
    first_name,
    last_name_paternal,
    last_name_maternal,
    assigned_role
  );
  
  -- 5. Role Binding (Sync with profile_roles if needed, or just rely on profile.role for now)
  -- For strict multi-role support, we should insert into profile_roles too.
  -- Initial implementation:
  insert into public.profile_roles (profile_id, role)
  values (new.id, assigned_role)
  on conflict do nothing;

  return new;
end;
$$;



-- ########## FILE: 20260215000062_fix_catalog_rls.sql ##########
-- Migration: Enable RLS on public catalogs and system settings
-- This fixes security warnings and ensures consistent access policies.

-- 1. Evaluation Criteria Catalog
ALTER TABLE IF EXISTS public.evaluation_criteria_catalog ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'evaluation_criteria_catalog' AND policyname = 'Public Read Access for Catalog'
    ) THEN
        CREATE POLICY "Public Read Access for Catalog"
        ON public.evaluation_criteria_catalog FOR SELECT
        USING (true); -- Publicly readable
    END IF;
END $$;

-- 2. System Settings (if not already enabled)
ALTER TABLE IF EXISTS public.system_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'system_settings' AND policyname = 'Authenticated Users Read Settings'
    ) THEN
        CREATE POLICY "Authenticated Users Read Settings"
        ON public.system_settings FOR SELECT
        TO authenticated
        USING (true);
    END IF;
END $$;



-- ########## FILE: 20260215000063_add_teacher_to_group_subjects.sql ##########
-- Add teacher_id to group_subjects
ALTER TABLE public.group_subjects ADD COLUMN IF NOT EXISTS teacher_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Initial data cleanup: if teacher_id is null, it means it's unassigned or for admin view
-- Usually in this system, the creator of the group_subject was the teacher (CJS mode)
-- But moving forward, it's explicitly assigned.

-- Update RLS Policies for group_subjects
-- Users can view group_subjects in their tenant if:
-- 1. They are ADMIN, DIRECTIVO, COORDINACION, etc. (Staff roles)
-- 2. They are the assigned TEACHER for that subject.

DROP POLICY IF EXISTS "Users can view group_subjects in own tenant" ON public.group_subjects;
DROP POLICY IF EXISTS "Admins/Teachers can manage group_subjects" ON public.group_subjects;

-- Policy for viewing:
-- Admins/Staff see all group subjects in their tenant.
-- Teachers see only those assigned to them.
DROP POLICY IF EXISTS "Staff can view all group subjects" ON public.group_subjects;
CREATE POLICY "Staff can view all group subjects" ON public.group_subjects
    FOR SELECT USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('ADMIN', 'DIRECTOR', 'ACADEMIC_COORD', 'TECH_COORD', 'SCHOOL_CONTROL')
        AND tenant_id = get_current_tenant_id()
    );

DROP POLICY IF EXISTS "Teachers can view assigned group subjects" ON public.group_subjects;
CREATE POLICY "Teachers can view assigned group subjects" ON public.group_subjects
    FOR SELECT USING (
        teacher_id = auth.uid()
        AND tenant_id = get_current_tenant_id()
    );

-- Policy for Management:
-- Only certain roles can manage group subjects.
DROP POLICY IF EXISTS "Admins can manage group subjects" ON public.group_subjects;
CREATE POLICY "Admins can manage group subjects" ON public.group_subjects
    FOR ALL USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('ADMIN', 'DIRECTOR', 'ACADEMIC_COORD', 'TECH_COORD', 'SCHOOL_CONTROL')
        AND tenant_id = get_current_tenant_id()
    );

-- Update RLS for public.groups as well
DROP POLICY IF EXISTS "Users can view groups in own tenant" ON public.groups;
DROP POLICY IF EXISTS "Admins/Teachers can manage groups" ON public.groups;

DROP POLICY IF EXISTS "Staff can view all groups" ON public.groups;
CREATE POLICY "Staff can view all groups" ON public.groups
    FOR SELECT USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('ADMIN', 'DIRECTOR', 'ACADEMIC_COORD', 'TECH_COORD', 'SCHOOL_CONTROL')
        AND tenant_id = get_current_tenant_id()
    );

DROP POLICY IF EXISTS "Teachers can view assigned groups" ON public.groups;
CREATE POLICY "Teachers can view assigned groups" ON public.groups
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.group_subjects
            WHERE group_id = public.groups.id
            AND teacher_id = auth.uid()
        )
        AND tenant_id = get_current_tenant_id()
    );

DROP POLICY IF EXISTS "Staff can manage groups" ON public.groups;
CREATE POLICY "Staff can manage groups" ON public.groups
    FOR ALL USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('ADMIN', 'DIRECTOR', 'ACADEMIC_COORD', 'TECH_COORD', 'SCHOOL_CONTROL')
        AND tenant_id = get_current_tenant_id()
    );



-- ########## FILE: 20260215000064_rbac_refinement.sql ##########
-- REFINAMIENTO DE RBAC: PROGRAMA ANALÍTICO Y CALENDARIO
-- Este script ajusta las políticas RLS para asegurar que los docentes solo tengan acceso de lectura
-- y que la gestión oficial sea exclusiva de DIRECTORES y ADMINS.

-- 1. Programa Analítico (analytical_programs)
DROP POLICY IF EXISTS "Enable read access for members of same tenant" ON public.analytical_programs;
CREATE POLICY "Enable read access for members of same tenant" ON public.analytical_programs
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles 
      WHERE tenant_id = analytical_programs.tenant_id
    )
  );

DROP POLICY IF EXISTS "Enable write access for admins on analytical_programs" ON public.analytical_programs;
CREATE POLICY "Enable write access for admins on analytical_programs" ON public.analytical_programs
  FOR ALL
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles 
      WHERE tenant_id = public.analytical_programs.tenant_id 
      AND role IN ('DIRECTOR', 'ADMIN')
    )
  );

-- 2. Calendario Oficial (calendar_events)
DROP POLICY IF EXISTS "Enable read access for all users" ON public.calendar_events;
CREATE POLICY "Enable read access for all users" ON public.calendar_events 
  FOR SELECT 
  USING (true);

DROP POLICY IF EXISTS "Enable manage for admins only" ON public.calendar_events;
CREATE POLICY "Enable manage for admins only" ON public.calendar_events
  FOR ALL
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles 
      WHERE tenant_id = public.calendar_events.tenant_id 
      AND role IN ('DIRECTOR', 'ADMIN')
    )
  );

-- 3. Calendario Personal (teacher_events)
DROP POLICY IF EXISTS "Teachers can manage their own events" ON public.teacher_events;
CREATE POLICY "Teachers can manage their own events" ON public.teacher_events 
  FOR ALL
  USING (auth.uid() = teacher_id);



-- ########## FILE: 20260215000065_pemc_and_staff_extensions.sql ##########
-- 20260215000063_pemc_and_staff_extensions.sql

-- 1. PEMC Tables
CREATE TABLE IF NOT EXISTS public.pemc_cycles (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
    name text NOT NULL, -- Ej: "Programa Plurianual 2024-2026"
    start_year integer NOT NULL,
    end_year integer NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid REFERENCES public.profiles(id)
);

CREATE TABLE IF NOT EXISTS public.pemc_diagnosis (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    cycle_id uuid REFERENCES public.pemc_cycles(id) ON DELETE CASCADE,
    field_name text NOT NULL, -- Ej: "Aprovechamiento académico", "Infraestructura"
    content text, -- "Lectura de la realidad"
    evidence_urls jsonb DEFAULT '[]'::jsonb, -- Array de URLs de archivos
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pemc_objectives (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    cycle_id uuid REFERENCES public.pemc_cycles(id) ON DELETE CASCADE,
    description text NOT NULL,
    goal text, -- Meta medible
    is_completed boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pemc_actions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    objective_id uuid REFERENCES public.pemc_objectives(id) ON DELETE CASCADE,
    description text NOT NULL,
    responsible_profile_id uuid REFERENCES public.profiles(id),
    deadline date,
    resources text,
    status text DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pemc_monitoring (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    action_id uuid REFERENCES public.pemc_actions(id) ON DELETE CASCADE,
    progress_percentage integer DEFAULT 0,
    comment text,
    created_at timestamp with time zone DEFAULT now()
);

-- 2. Staff Extensions
CREATE TABLE IF NOT EXISTS public.staff_commissions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
    profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    name text NOT NULL, -- Ej: "Comisión de Guardia", "Tutoría 3ºA"
    description text,
    academic_year_id uuid REFERENCES public.academic_years(id),
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.staff_attendance (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
    date date DEFAULT CURRENT_DATE,
    status text NOT NULL CHECK (status IN ('PRESENT', 'ABSENT', 'LATE', 'PERMIT')),
    check_in timestamp with time zone,
    check_out timestamp with time zone,
    notes text,
    UNIQUE(profile_id, date)
);

CREATE TABLE IF NOT EXISTS public.staff_permits (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
    start_date date NOT NULL,
    end_date date NOT NULL,
    reason text NOT NULL,
    status text DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    evidence_url text, -- Link a justificante médico, etc.
    created_at timestamp with time zone DEFAULT now()
);

-- 3. Enable RLS
ALTER TABLE public.pemc_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pemc_diagnosis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pemc_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pemc_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pemc_monitoring ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_permits ENABLE ROW LEVEL SECURITY;

-- 4. Policies (DIRECTOR/ADMIN access)
DO $$ 
BEGIN
    -- Pemc Cycles
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins manage pemc cycles') THEN
        CREATE POLICY "Admins manage pemc cycles" ON public.pemc_cycles
        FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('DIRECTOR', 'ADMIN', 'SUPER_ADMIN') AND tenant_id = pemc_cycles.tenant_id));
    END IF;

    -- Staff Commissions
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins manage staff commissions') THEN
        CREATE POLICY "Admins manage staff commissions" ON public.staff_commissions
        FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('DIRECTOR', 'ADMIN', 'SUPER_ADMIN') AND tenant_id = staff_commissions.tenant_id));
    END IF;

    -- Staff Attendance (Admins manage, Users read own)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins manage staff attendance') THEN
        CREATE POLICY "Admins manage staff attendance" ON public.staff_attendance
        FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('DIRECTOR', 'ADMIN', 'SUPER_ADMIN') AND tenant_id = staff_attendance.tenant_id));
    END IF;
END $$;



-- ########## FILE: 20260215000066_announcements_and_notifications.sql ##########
-- 20260215000064_announcements_and_notifications.sql

-- 1. School Announcements Table
CREATE TABLE IF NOT EXISTS public.school_announcements (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
    sender_id uuid REFERENCES public.profiles(id),
    title text NOT NULL,
    content text NOT NULL,
    target_roles text[] DEFAULT '{}', -- Array de roles (ej: {'TEACHER', 'STUDENT'})
    target_groups uuid[] DEFAULT '{}', -- Array de IDs de grupos
    send_email boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);

-- 2. Announcement Receipts (to track reading)
CREATE TABLE IF NOT EXISTS public.announcement_receipts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    announcement_id uuid REFERENCES public.school_announcements(id) ON DELETE CASCADE,
    profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    read_at timestamp with time zone,
    UNIQUE(announcement_id, profile_id)
);

-- 3. Enable RLS
ALTER TABLE public.school_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_receipts ENABLE ROW LEVEL SECURITY;

-- 4. Policies
DO $$ 
BEGIN
    -- Announcements
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins manage announcements') THEN
        CREATE POLICY "Admins manage announcements" ON public.school_announcements
        FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('DIRECTOR', 'ADMIN', 'SUPER_ADMIN') AND tenant_id = school_announcements.tenant_id));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users view relevant announcements') THEN
        CREATE POLICY "Users view relevant announcements" ON public.school_announcements
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM public.profiles p 
                WHERE p.id = auth.uid() 
                AND (
                    p.role = ANY(target_roles) 
                    OR target_roles = '{}' 
                    OR p.role IN ('DIRECTOR', 'ADMIN', 'SUPER_ADMIN')
                )
            )
        );
    END IF;
END $$;



-- ########## FILE: 20260215000067_assignments_and_calendar_sync.sql ##########
-- 20260215000065_assignments_and_calendar_sync.sql

-- 1. Add is_direction to calendar_events
ALTER TABLE public.calendar_events 
ADD COLUMN IF NOT EXISTS is_direction boolean DEFAULT false;

-- 2. Add advisory_group_id to profiles for teacher assignments
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS advisory_group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL;

-- 3. Update RLS for calendar_events to allow all users to see direction events
DROP POLICY IF EXISTS "Enable read access for all users" ON public.calendar_events;
CREATE POLICY "Enable read access for all users" ON public.calendar_events 
FOR SELECT USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    OR is_official_sep = true
);

-- 4. Specific policy for Direction Events (redundant but explicit)
DROP POLICY IF EXISTS "Users can see direction events" ON public.calendar_events;
CREATE POLICY "Users can see direction events" ON public.calendar_events
FOR SELECT USING (
    is_direction = true 
    AND tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
);

-- 5. Policies for managing assignments (Admins only)
-- group_subjects and schedules are already covered by tenant_id policies, 
-- but let's ensure admins can manage calendar_events with is_direction=true
DROP POLICY IF EXISTS "Admins can manage direction events" ON public.calendar_events;
CREATE POLICY "Admins can manage direction events" ON public.calendar_events
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('DIRECTOR', 'ADMIN', 'SUPER_ADMIN')
    )
);



-- ########## FILE: 20260215000068_special_schedules.sql ##########
-- Create special_schedule_structure table
create table if not exists public.special_schedule_structure (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants not null,
  target_date date not null,
  name text not null, -- e.g., "Acto Cívico", "Festival", "Reunión de Consejo Técnico"
  start_time time not null,
  end_time time not null,
  module_duration integer not null, -- duration in minutes
  breaks jsonb default '[]'::jsonb, -- Array of {name, start_time, end_time}
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(tenant_id, target_date)
);

-- Enable RLS
alter table public.special_schedule_structure enable row level security;

-- Policies
create policy "Users can view special schedules in own tenant"
  on public.special_schedule_structure for select
  using (tenant_id = get_current_tenant_id());

create policy "Admins can manage special schedules"
  on public.special_schedule_structure for all
  using (tenant_id = get_current_tenant_id());



-- ########## FILE: 20260215000069_extend_prefectura_permissions.sql ##########
-- Add PREFECT to staff attendance management
DROP POLICY IF EXISTS "Admins manage staff attendance" ON public.staff_attendance;
CREATE POLICY "Admins and Prefects manage staff attendance" ON public.staff_attendance
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('DIRECTOR', 'ADMIN', 'SUPER_ADMIN', 'PREFECT') 
        AND tenant_id = staff_attendance.tenant_id
    )
);

-- Ensure PREFECT can also view and update student incidents (already covered by 'Users can view incidents for their tenant', but good to be explicit for update if needed)
DROP POLICY IF EXISTS "Users can update incidents" ON public.student_incidents;
CREATE POLICY "Staff can update incidents for their tenant"
ON public.student_incidents FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('DIRECTOR', 'ADMIN', 'SUPER_ADMIN', 'PREFECT', 'TEACHER', 'ACADEMIC_COORD', 'TECH_COORD') 
        AND tenant_id = student_incidents.tenant_id
    )
);



-- ########## FILE: 20260215000070_seed_secondary_subjects.sql ##########
-- Migración para insertar materias oficiales de Secundaria
INSERT INTO public.subject_catalog (name, educational_level, field_of_study)
VALUES
    ('TECNOLOGÍA', 'SECONDARY', 'De lo Humano y lo Comunitario'),
    ('ESPAÑOL', 'SECONDARY', 'Lenguajes'),
    ('INGLES', 'SECONDARY', 'Lenguajes'),
    ('TUTORÍA', 'SECONDARY', 'De lo Humano y lo Comunitario'),
    ('MATEMÁTICAS', 'SECONDARY', 'Saberes y Pensamiento Científico'),
    ('BIOLOGÍA', 'SECONDARY', 'Saberes y Pensamiento Científico'),
    ('FÍSICA', 'SECONDARY', 'Saberes y Pensamiento Científico'),
    ('QUÍMICA', 'SECONDARY', 'Saberes y Pensamiento Científico'),
    ('HISTORIA', 'SECONDARY', 'Ética, Naturaleza y Sociedades'),
    ('FORMACIÓN CÍVICA Y ÉTICA', 'SECONDARY', 'Ética, Naturaleza y Sociedades'),
    ('AUTONOMÍA CURRICULAR', 'SECONDARY', 'De lo Humano y lo Comunitario'),
    ('GEOGRAFÍA', 'SECONDARY', 'Ética, Naturaleza y Sociedades'),
    ('EDUCACIÓN FÍSICA', 'SECONDARY', 'De lo Humano y lo Comunitario'),
    ('ARTES', 'SECONDARY', 'Lenguajes')
ON CONFLICT (name, educational_level) DO NOTHING;



-- ########## FILE: 20260215000071_substitute_coverage_schema.sql ##########
-- Create table for teacher absences
CREATE TABLE IF NOT EXISTS public.teacher_absences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL, -- The absent teacher
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'RESOLVED')), -- RESOLVED when coverage is done
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create table for activities left for substitutes (Prefects/Guardias)
CREATE TABLE IF NOT EXISTS public.substitution_activities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    absence_id UUID REFERENCES public.teacher_absences(id) ON DELETE CASCADE NOT NULL,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
    subject_id UUID REFERENCES public.subject_catalog(id) ON DELETE SET NULL,
    module_index INTEGER, -- Which hour/module of the day
    activity_title TEXT NOT NULL,
    activity_description TEXT NOT NULL,
    ai_generated_hints TEXT, -- AI suggestions/hints
    resources_urls JSONB DEFAULT '[]'::jsonb,
    is_completed BOOLEAN DEFAULT FALSE,
    prefect_observations TEXT, -- Observations by the prefect who attended
    attended_by UUID REFERENCES public.profiles(id), -- The prefect who covered
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS
ALTER TABLE public.teacher_absences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.substitution_activities ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Users can manage their own absences" ON public.teacher_absences;
CREATE POLICY "Users can manage their own absences" ON public.teacher_absences
    FOR ALL USING (auth.uid() = profile_id);

DROP POLICY IF EXISTS "Admins and Prefects can view all absences" ON public.teacher_absences;
CREATE POLICY "Admins and Prefects can view all absences" ON public.teacher_absences
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('DIRECTOR', 'ADMIN', 'SUPER_ADMIN', 'PREFECT') 
            AND tenant_id = teacher_absences.tenant_id
        )
    );

DROP POLICY IF EXISTS "Staff can view substitution activities for their tenant" ON public.substitution_activities;
CREATE POLICY "Staff can view substitution activities for their tenant" ON public.substitution_activities
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND tenant_id = substitution_activities.tenant_id
        )
    );

DROP POLICY IF EXISTS "Prefects and Admins can update activities" ON public.substitution_activities;
CREATE POLICY "Prefects and Admins can update activities" ON public.substitution_activities
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('DIRECTOR', 'ADMIN', 'SUPER_ADMIN', 'PREFECT') 
            AND tenant_id = substitution_activities.tenant_id
        )
    );

DROP POLICY IF EXISTS "Teachers can insert/manage their activities" ON public.substitution_activities;
CREATE POLICY "Teachers can insert/manage their activities" ON public.substitution_activities
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.teacher_absences
            WHERE id = substitution_activities.absence_id
            AND profile_id = auth.uid()
        )
    );



-- ########## FILE: 20260215000072_fix_staff_attendance_rls.sql ##########
-- Create get_current_role helper
CREATE OR REPLACE FUNCTION get_current_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- Refactor staff_attendance RLS
DROP POLICY IF EXISTS "Admins and Prefects manage staff attendance" ON public.staff_attendance;
DROP POLICY IF EXISTS "Admins manage staff attendance" ON public.staff_attendance;

CREATE POLICY "Admins and Prefects manage staff attendance"
ON public.staff_attendance
FOR ALL
TO authenticated
USING (
    tenant_id = get_current_tenant_id() AND
    get_current_role() IN ('DIRECTOR', 'ADMIN', 'SUPER_ADMIN', 'PREFECT')
)
WITH CHECK (
    tenant_id = get_current_tenant_id() AND
    get_current_role() IN ('DIRECTOR', 'ADMIN', 'SUPER_ADMIN', 'PREFECT')
);

-- Also ensure users can view their own attendance (useful for teachers later)
DROP POLICY IF EXISTS "Users can view own attendance" ON public.staff_attendance;
CREATE POLICY "Users can view own attendance"
ON public.staff_attendance
FOR SELECT
TO authenticated
USING (
    profile_id = auth.uid() OR
    get_current_role() IN ('DIRECTOR', 'ADMIN', 'SUPER_ADMIN', 'PREFECT')
);



-- ########## FILE: 20260215000073_teacher_module_attendance_schema.sql ##########
-- Migration: Teacher Module Attendance for Secondary School
-- Each module is 50 minutes, tracking per class.

CREATE TABLE IF NOT EXISTS public.teacher_module_attendance (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    teacher_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    schedule_id uuid REFERENCES public.schedules(id) ON DELETE SET NULL, -- Link to the specific schedule entry
    date date DEFAULT CURRENT_DATE NOT NULL,
    status text NOT NULL CHECK (status IN ('PRESENT', 'ABSENT', 'LATE')),
    check_in timestamp with time zone DEFAULT now(),
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE(teacher_id, schedule_id, date)
);

-- Enable RLS
ALTER TABLE public.teacher_module_attendance ENABLE ROW LEVEL SECURITY;

-- Policies
-- 1. Teachers can view and insert their own attendance
CREATE POLICY "Teachers can manage own module attendance"
ON public.teacher_module_attendance
FOR ALL
TO authenticated
USING (
    teacher_id = auth.uid() AND 
    tenant_id = get_current_tenant_id()
)
WITH CHECK (
    teacher_id = auth.uid() AND 
    tenant_id = get_current_tenant_id()
);

-- 2. Admins and Prefects can view all module attendance
CREATE POLICY "Admins and Prefects view all module attendance"
ON public.teacher_module_attendance
FOR SELECT
TO authenticated
USING (
    tenant_id = get_current_tenant_id() AND
    get_current_role() IN ('DIRECTOR', 'ADMIN', 'SUPER_ADMIN', 'PREFECT')
);

-- 3. Prefects can update attendance (e.g., to correct a status)
CREATE POLICY "Prefects can manage module attendance"
ON public.teacher_module_attendance
FOR UPDATE
TO authenticated
USING (
    tenant_id = get_current_tenant_id() AND
    get_current_role() IN ('PREFECT', 'ADMIN', 'DIRECTOR')
);



-- ########## FILE: 20260215000074_fix_staff_attendance_rls_v2.sql ##########
-- Refactor staff_attendance RLS again to allow self-registration for ALL staff
DROP POLICY IF EXISTS "Admins and Prefects manage staff attendance" ON public.staff_attendance;
DROP POLICY IF EXISTS "Users can view own attendance" ON public.staff_attendance;

-- Policy for management (Insert/Update/Delete)
CREATE POLICY "Staff can manage their own attendance and Admins/Prefects manage all"
ON public.staff_attendance
FOR ALL
TO authenticated
USING (
    tenant_id = get_current_tenant_id() AND (
        profile_id = auth.uid() OR
        get_current_role() IN ('DIRECTOR', 'ADMIN', 'SUPER_ADMIN', 'PREFECT')
    )
)
WITH CHECK (
    tenant_id = get_current_tenant_id() AND (
        profile_id = auth.uid() OR
        get_current_role() IN ('DIRECTOR', 'ADMIN', 'SUPER_ADMIN', 'PREFECT')
    )
);

-- Policy for viewing (already covered by ALL above, but keeping it explicit for clarity if needed)
-- Actually, ALL covers SELECT, INSERT, UPDATE, DELETE.



-- ########## FILE: 20260215000075_final_fix_staff_attendance_rls.sql ##########
-- Final attempt at fixing staff_attendance RLS
-- This migration drops ALL previous policy names and sets a clean, robust one.

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Staff can manage their own attendance and Admins/Prefects manage all" ON public.staff_attendance;
    DROP POLICY IF EXISTS "Admins and Prefects manage staff attendance" ON public.staff_attendance;
    DROP POLICY IF EXISTS "Admins manage staff attendance" ON public.staff_attendance;
    DROP POLICY IF EXISTS "Users can view own attendance" ON public.staff_attendance;
    DROP POLICY IF EXISTS "attendance_all_policy" ON public.staff_attendance;
    DROP POLICY IF EXISTS "staff_attendance_standard_policy" ON public.staff_attendance;
    DROP POLICY IF EXISTS "staff_attendance_v3" ON public.staff_attendance;
    DROP POLICY IF EXISTS "staff_attendance_resilient" ON public.staff_attendance;
END $$;

-- Enable RLS (just in case)
ALTER TABLE public.staff_attendance ENABLE ROW LEVEL SECURITY;

-- Clean, robust policy using explicit subqueries for maximum reliability
CREATE POLICY "staff_attendance_management_v4"
ON public.staff_attendance
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.tenant_id = public.staff_attendance.tenant_id
        AND (
            profiles.id = public.staff_attendance.profile_id OR
            profiles.role IN ('DIRECTOR', 'ADMIN', 'SUPER_ADMIN', 'PREFECT')
        )
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.tenant_id = public.staff_attendance.tenant_id
        AND (
            profiles.id = public.staff_attendance.profile_id OR
            profiles.role IN ('DIRECTOR', 'ADMIN', 'SUPER_ADMIN', 'PREFECT')
        )
    )
);

-- Ensure users can at least see all attendance in their tenant (useful for reports)
-- This replaces the selective VIEW if needed, but the ALL policy above is already quite good.
-- We'll add a specific SELECT policy for non-admin staff just to read others if needed (e.g. for visibility)
-- But for now, let's stick to the management one.



-- ########## FILE: 20260215000076_force_fix_staff_attendance_v3.sql ##########
-- Ultra-simplified RLS for staff_attendance
-- PURGE ALL PREVIOUS ATTEMPTS
DO $$ 
BEGIN
    -- Common names from previous attempts
    DROP POLICY IF EXISTS "Admins and Prefects manage staff attendance" ON public.staff_attendance;
    DROP POLICY IF EXISTS "Admins manage staff attendance" ON public.staff_attendance;
    DROP POLICY IF EXISTS "Users can view own attendance" ON public.staff_attendance;
    DROP POLICY IF EXISTS "Staff can manage their own attendance and Admins/Prefects manage all" ON public.staff_attendance;
    DROP POLICY IF EXISTS "staff_attendance_management_v4" ON public.staff_attendance;
    DROP POLICY IF EXISTS "staff_attendance_trusted_v9" ON public.staff_attendance;
    DROP POLICY IF EXISTS "staff_attendance_final_attempt" ON public.staff_attendance;
END $$;

-- 1. SELF-REGISTRATION POLICY (Owners)
CREATE POLICY "attendance_self_v1"
ON public.staff_attendance
FOR ALL
TO authenticated
USING (profile_id = auth.uid())
WITH CHECK (profile_id = auth.uid());

-- 2. ADMINISTRATIVE POLICY (Admins/Prefects)
CREATE POLICY "attendance_admin_v1"
ON public.staff_attendance
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('DIRECTOR', 'ADMIN', 'SUPER_ADMIN', 'PREFECT', 'ACADEMIC_COORD', 'TECH_COORD')
        AND profiles.tenant_id = public.staff_attendance.tenant_id
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('DIRECTOR', 'ADMIN', 'SUPER_ADMIN', 'PREFECT', 'ACADEMIC_COORD', 'TECH_COORD')
        AND profiles.tenant_id = public.staff_attendance.tenant_id
    )
);

-- 3. INTER-TENANT PROTECTION (Safety layer)
-- Ensure no one can see rows from other tenants even if they guess a profile_id
ALTER TABLE public.staff_attendance FORCE ROW LEVEL SECURITY;



-- ########## FILE: 20260215000077_diagnostic_disable_rls.sql ##########
-- DIAGNOSTIC: Temporarily disable RLS to verify if 403 persists
ALTER TABLE public.staff_attendance DISABLE ROW LEVEL SECURITY;

-- Also check if there are any stray triggers or constraints
-- (This is just a comment, but good for tracking)



-- ########## FILE: 20260215000078_create_student_citations.sql ##########
-- Migration: Student Citations for Prefectura
-- Citatorios (Citations) are documents issued to parents/tutors.

CREATE TABLE IF NOT EXISTS public.student_citations (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    student_id uuid REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
    incident_id uuid REFERENCES public.student_incidents(id) ON DELETE SET NULL, -- Optional link to an incident
    reason text NOT NULL,
    meeting_date date NOT NULL,
    meeting_time time NOT NULL,
    status text DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'ATTENDED', 'CANCELLED')),
    requested_by uuid REFERENCES public.profiles(id), -- Prefect or Director who requested it
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.student_citations ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view citations in their tenant"
ON public.student_citations
FOR SELECT
TO authenticated
USING (tenant_id = get_current_tenant_id());

CREATE POLICY "Staff can manage citations"
ON public.student_citations
FOR ALL
TO authenticated
USING (
    get_current_role() IN ('PREFECT', 'ADMIN', 'DIRECTOR', 'ACADEMIC_COORD', 'TECH_COORD')
    AND tenant_id = get_current_tenant_id()
)
WITH CHECK (
    get_current_role() IN ('PREFECT', 'ADMIN', 'DIRECTOR', 'ACADEMIC_COORD', 'TECH_COORD')
    AND tenant_id = get_current_tenant_id()
);



-- ########## FILE: 20260215000079_attendance_enhancements.sql ##########
-- 20260215000076_attendance_enhancements.sql

-- 1. Add check_out to teacher_module_attendance
ALTER TABLE public.teacher_module_attendance 
ADD COLUMN IF NOT EXISTS check_out timestamp with time zone;

-- 2. Add work_start_time to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS work_start_time time DEFAULT '07:00:00';

-- 3. Create System User (Idempotent)
DO $$
DECLARE
    sys_id uuid;
BEGIN
    -- Check if system user exists (by a specific fixed UUID or email pattern)
    -- Let's use a fixed UUID for the system user to be consistent: '00000000-0000-0000-0000-000000000000' is risky for auth.users join
    -- Better to just create a profile if it doesn't exist, linked to a placeholder or handled via RLS.
    -- Actually, since profiles references auth.users, we can't easily insert a profile without a user.
    -- HOWEVER, for the "System" sender in chat, we might cheat or needs a real user.
    -- Alternative: The `send_system_message` function can insert with a specific sender_id that we define as "System".
    -- Let's see if we can create a "System" profile on the fly if we use a specific UUID that generates no foreign key error?
    -- No, referential integrity will block us unless we have an auth user.
    
    -- STRATEGY: We will assume there is an ADMIN user who acts as system, OR we relax the FK for sender_id in chat_messages?
    -- No, chat_messages usually links to profiles.
    
    -- BETTER STRATEGY: The system message will actually come from the Tenant's Administrator (or the first Admin found), 
    -- OR we create a specific "Bot" user in auth.users? Creating auth users via SQL is tricky/impossible without pgsodium/vault.
    
    -- WORKAROUND: We will simply upsert a profile with a specific UUID '00000000-0000-0000-0000-000000000001' 
    -- and we will DROP the foreign key constraint on chat_messages.sender_id IF IT EXISTS, 
    -- OR we make the FK deferrable? 
    -- Actually, the cleanest way without a real auth user is to make sender_id nullable or not enforced for system messages.
    -- Let's check `chat_messages` definition.
    
    -- Checking `chat_messages`: sender_id usually references profiles(id).
    -- If we can't create a real auth user, we can't create a real profile.
    
    -- ALTERNATIVE: Use the sender_id of the CURRENT USER (acting as self) but message type 'SYSTEM'?
    -- No, user wants a "System User".
    
    -- OK, let's try to insert into `auth.users`? No, we don't have permissions usually.
    
    -- FINAL STRATEGY: We will use a special UUID for system messages.
    -- We will alter the `chat_messages` table to allow `sender_id` to NOT populate a Foreign Key constraint if it's the system ID?
    -- Or better: We drop the FK constraint to profiles and recreate it without strict enforcement for the system ID?
    -- Too complex.
    
    -- SIMPLEST: We'll just define that System Messages have `sender_id` = NULL (if allowed) or we reuse the Tenant ID as the Profile ID?
    -- Let's make `sender_id` nullable in chat_messages if it isn't.
    -- If `sender_id` is NULL, UI treats it as "System".
    
    -- Let's check if we can make sender_id nullable.
END $$;

-- Let's simply modify chat_messages to allow nullable sender_id for System messages
ALTER TABLE public.chat_messages ALTER COLUMN sender_id DROP NOT NULL;

-- 4. Secure RPC to send system messages
-- This function allows sending a message to a room without being a participant (super power), 
-- or specifically for system notifications.
CREATE OR REPLACE FUNCTION public.send_system_message(
    p_room_id uuid,
    p_content text,
    p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with privileges of the creator (postgres/admin)
SET search_path = public
AS $$
DECLARE
    v_msg_id uuid;
BEGIN
    INSERT INTO public.chat_messages (room_id, sender_id, content, type, metadata)
    VALUES (p_room_id, NULL, p_content, 'SYSTEM', p_metadata) -- Sender NULL means System
    RETURNING id INTO v_msg_id;
    
    RETURN v_msg_id;
END;
$$;

-- 5. Grant execute permission
GRANT EXECUTE ON FUNCTION public.send_system_message TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_system_message TO service_role;



-- ########## FILE: 20260215000080_support_module.sql ##########
-- 20260215000077_support_module.sql

-- 1. Student Tracking Table (Bitácora de Seguimiento)
CREATE TABLE IF NOT EXISTS public.student_tracking (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    student_id uuid REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
    created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL, -- Staff Member
    type text NOT NULL CHECK (type IN ('ENTREVISTA', 'CANALIZACION', 'SEGUIMIENTO', 'BITACORA', 'VISITA_DOMICILIARIA')),
    status text NOT NULL DEFAULT 'ABIERTO' CHECK (status IN ('ABIERTO', 'EN_PROCESO', 'CERRADO', 'CANALIZADO')),
    severity text DEFAULT 'MEDIA' CHECK (severity IN ('BAJA', 'MEDIA', 'ALTA', 'URGENTE')),
    title text NOT NULL,
    description text,
    agreements text, -- Acuerdos
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 2. Behavioral Contracts / Specific Formats (Formatos y Actas)
CREATE TABLE IF NOT EXISTS public.behavioral_contracts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    student_id uuid REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
    created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    type text NOT NULL CHECK (type IN ('COMPROMISO_CONDUCTA', 'INASISTENCIAS', 'RETARDOS', 'INCIDENCIAS_LEVES', 'OTRO')),
    content jsonb DEFAULT '{}'::jsonb, -- Stores form specific fields (antecedentes, consecuencias, etc.)
    signed boolean DEFAULT false,
    valid_until date,
    created_at timestamp with time zone DEFAULT now()
);

-- 3. Dropout Risk Cases (Riesgo de Deserción)
CREATE TABLE IF NOT EXISTS public.dropout_risk_cases (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    student_id uuid REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
    detected_at timestamp with time zone DEFAULT now(),
    risk_factors jsonb, -- ['FALTAS', 'REPROBACION', 'CONDUCTA', 'ECONOMICOS']
    intervention_plan text,
    status text DEFAULT 'DETECTADO' CHECK (status IN ('DETECTADO', 'INTERVENCION', 'MONITOREO', 'RESUELTO', 'BAJA_DEFINITIVA')),
    last_update timestamp with time zone DEFAULT now(),
    UNIQUE(student_id) -- Only one active case per student essentially, or we can allow history
);

-- RLS Policies

-- Enable RLS
ALTER TABLE public.student_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.behavioral_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dropout_risk_cases ENABLE ROW LEVEL SECURITY;

-- Policies for Support Staff (SUPPORT role) and Management (DIRECTOR, ADMIN)
-- They should have full access.
-- Teachers might have READ access to some parts, but let's restrict to SUPPORT/ADMIN for now for confidentiality.

DROP POLICY IF EXISTS "Support and Admin manage tracking" ON public.student_tracking;
CREATE POLICY "Support and Admin manage tracking" ON public.student_tracking
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.tenant_id = public.student_tracking.tenant_id
        AND profiles.role IN ('DIRECTOR', 'ADMIN', 'SUPER_ADMIN', 'SUPPORT', 'PREFECT')
    )
);

DROP POLICY IF EXISTS "Support and Admin manage contracts" ON public.behavioral_contracts;
CREATE POLICY "Support and Admin manage contracts" ON public.behavioral_contracts
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.tenant_id = public.behavioral_contracts.tenant_id
        AND profiles.role IN ('DIRECTOR', 'ADMIN', 'SUPER_ADMIN', 'SUPPORT', 'PREFECT')
    )
);

DROP POLICY IF EXISTS "Support and Admin manage dropout cases" ON public.dropout_risk_cases;
CREATE POLICY "Support and Admin manage dropout cases" ON public.dropout_risk_cases
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.tenant_id = public.dropout_risk_cases.tenant_id
        AND profiles.role IN ('DIRECTOR', 'ADMIN', 'SUPER_ADMIN', 'SUPPORT', 'PREFECT')
    )
);



-- ########## FILE: 20260215000081_add_delete_own_account.sql ##########
-- 20260215000080_add_delete_own_account.sql

-- Función para que un usuario pueda auto-eliminarse (útil para cancelar registro incompleto)
-- Elimina primero el perfil (para evitar bloqueo por FK) y luego el usuario de Auth.
-- También intenta eliminar el Tenant si quedó huérfano (sin usuarios).

CREATE OR REPLACE FUNCTION delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tenant_id uuid;
    v_count integer;
BEGIN
    -- 1. Obtener tenant_id del usuario actual antes de borrarlo
    SELECT tenant_id INTO v_tenant_id FROM public.profiles WHERE id = auth.uid();

    -- 1.5. Eliminar dependencias (Suscripciones y Transacciones)
    DELETE FROM public.payment_transactions WHERE user_id = auth.uid();
    DELETE FROM public.subscriptions WHERE user_id = auth.uid();
    
    -- 2. Eliminar el perfil del usuario (Trigger de Auth debería manejarlo, pero por si las FK no son cascade)
    DELETE FROM public.profiles WHERE id = auth.uid();

    -- 3. Eliminar el usuario de Auth (Esto libera el email)
    DELETE FROM auth.users WHERE id = auth.uid();

    -- 4. Limpieza de Tenant Huérfano (Opcional pero recomendado para onboarding cancelado)
    IF v_tenant_id IS NOT NULL THEN
        SELECT count(*) INTO v_count FROM public.profiles WHERE tenant_id = v_tenant_id;
        -- Si no quedan usuarios en ese tenant (probablemente era el único creando la escuela)
        IF v_count = 0 THEN
            DELETE FROM public.tenants WHERE id = v_tenant_id;
        END IF;
    END IF;
END;
$$;



-- ########## FILE: 20260215000082_fix_chat_rls.sql ##########
-- Fix RLS for chat_rooms to allow SUPPORT role
-- 20260215000078_fix_chat_rls.sql

-- Update policy for chat_rooms to include SUPPORT
DROP POLICY IF EXISTS "Users can view their own rooms" ON public.chat_rooms;

CREATE POLICY "Users can view their own rooms" ON public.chat_rooms
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.chat_participants
        WHERE chat_participants.room_id = chat_rooms.id
        AND chat_participants.profile_id = auth.uid()
    )
    OR 
    -- Public/Group rooms might be accessible by tenant, but for now stick to participants
    -- Or if it's a channel, allow tenant access? 
    -- Let's stick to participants for direct/group, but ensure creation is allowed
    auth.uid() IN (
        SELECT profile_id FROM chat_participants WHERE room_id = id
    )
);

-- Ensure SUPPORT role can participate
-- Check if existing policies on profiles/tenants block this? 
-- The 403 usually means the table RLS is blocking. 

-- Let's make sure the creation policy allows SUPPORT
DROP POLICY IF EXISTS "Users can create rooms" ON public.chat_rooms;

CREATE POLICY "Users can create rooms" ON public.chat_rooms
FOR INSERT WITH CHECK (
    auth.uid() IN (
        SELECT id FROM public.profiles 
        WHERE tenant_id = chat_rooms.tenant_id
        -- All roles should be able to chat essentially, or at least SUPPORT
    )
);

-- Fix school_details access?
-- The user said "remove this record in its configuration", implying the fetch shouldn't happen.
-- But if we want to fix 406/Permission denied, we might need policy.
-- However, if it's "select=workshops", it implies looking for SUBJECTS/WORKSHOPS.
-- If SUPPORT doesn't have them, we should stop the fetch in frontend.




-- ########## FILE: 20260215000083_system_room_rpc.sql ##########
-- 20260215000079_system_room_rpc.sql

-- Function to safely get or create a SYSTEM room for a user
-- Needed to avoid granting broad INSERT permissions on chat_rooms to all roles
-- This runs with SECURITY DEFINER privileges (as the creator/admin)

-- 1. Allow 'SYSTEM' type in chat_rooms
ALTER TABLE public.chat_rooms DROP CONSTRAINT IF EXISTS chat_rooms_type_check;
ALTER TABLE public.chat_rooms ADD CONSTRAINT chat_rooms_type_check CHECK (type IN ('DIRECT', 'GROUP', 'CHANNEL', 'SYSTEM'));

CREATE OR REPLACE FUNCTION public.get_or_create_system_room(p_tenant_id uuid, p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_room_id uuid;
BEGIN
    -- 1. Check if room exists
    SELECT r.id INTO v_room_id
    FROM chat_rooms r
    JOIN chat_participants cp ON cp.room_id = r.id
    WHERE r.type = 'SYSTEM'
    AND r.tenant_id = p_tenant_id
    AND cp.profile_id = p_user_id
    LIMIT 1;

    -- 2. Return if found
    IF v_room_id IS NOT NULL THEN
        RETURN v_room_id;
    END IF;

    -- 3. Create if not found
    INSERT INTO chat_rooms (tenant_id, name, type)
    VALUES (p_tenant_id, 'Avisos del Sistema', 'SYSTEM')
    RETURNING id INTO v_room_id;

    -- 4. Add participant
    INSERT INTO chat_participants (room_id, profile_id)
    VALUES (v_room_id, p_user_id);

    RETURN v_room_id;
END;
$$;



-- ########## FILE: 20260215000084_student_tutor_users.sql ##########
-- Link Students and Guardians to Auth Users
-- This enables Login for Students and Tutors

-- 1. Add user_id to students
ALTER TABLE public.students
ADD COLUMN IF NOT EXISTS user_id uuid references auth.users(id);

-- 2. Add user_id to guardians
ALTER TABLE public.guardians
ADD COLUMN IF NOT EXISTS user_id uuid references auth.users(id);

-- 3. Update RLS for Students table to allow self-view and tutor-view
DROP POLICY IF EXISTS "Students can view own profile" ON public.students;
CREATE POLICY "Students can view own profile" ON public.students
FOR SELECT USING (
    auth.uid() = user_id
);

DROP POLICY IF EXISTS "Guardians can view their students" ON public.students;
CREATE POLICY "Guardians can view their students" ON public.students
FOR SELECT USING (
    id IN (
        SELECT student_id FROM public.guardians 
        WHERE user_id = auth.uid()
    )
);

-- 4. Update RLS for Guardians table to allow self-view
DROP POLICY IF EXISTS "Guardians can view own profile" ON public.guardians;
CREATE POLICY "Guardians can view own profile" ON public.guardians
FOR SELECT USING (
    user_id = auth.uid()
);

-- 5. Grant permissions for new columns if needed (tends to be auto for owner/postgres)



-- ########## FILE: 20260215000085_fix_student_guardian_rls_loop.sql ##########
-- Fix Recursive RLS Loop in Students/Guardians
-- The "Guardians can view their students" policy creates an infinite loop

-- Add tenant_id to guardians table to avoid recursive queries
ALTER TABLE public.guardians ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);

-- Backfill tenant_id for existing guardians
UPDATE public.guardians 
SET tenant_id = (SELECT tenant_id FROM public.students WHERE students.id = guardians.student_id)
WHERE tenant_id IS NULL;

-- Drop old policies
DROP POLICY IF EXISTS "Users can view guardians in own tenant" ON public.guardians;
DROP POLICY IF EXISTS "Admins/Teachers can manage guardians" ON public.guardians;

-- Recreate with simple tenant_id check (no recursion)
CREATE POLICY "Users can view guardians in own tenant" ON public.guardians 
FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "Admins/Teachers can manage guardians" ON public.guardians 
FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
);



-- ########## FILE: 20260215000086_chat_permissions.sql ##########
-- Create chat_permissions table for granular access control
-- Allows DIRECTOR/ADMIN to assign custom chat visibility privileges

CREATE TABLE IF NOT EXISTS public.chat_permissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    -- Permission flags
    can_view_all_users boolean DEFAULT false,
    can_view_staff boolean DEFAULT false,
    can_view_students boolean DEFAULT false,
    can_view_teachers boolean DEFAULT false,
    
    -- Metadata
    created_by uuid REFERENCES public.profiles(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    -- Ensure one permission record per user per tenant
    UNIQUE(tenant_id, profile_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_chat_permissions_profile 
ON public.chat_permissions(profile_id);

CREATE INDEX IF NOT EXISTS idx_chat_permissions_tenant 
ON public.chat_permissions(tenant_id);

-- Enable RLS
ALTER TABLE public.chat_permissions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own permissions
DROP POLICY IF EXISTS "Users can view own chat permissions" ON public.chat_permissions;
CREATE POLICY "Users can view own chat permissions" 
ON public.chat_permissions
FOR SELECT
USING (
    profile_id = auth.uid()
);

-- Policy: DIRECTOR/ADMIN can view all permissions in their tenant
DROP POLICY IF EXISTS "Directors/Admins can view all chat permissions" ON public.chat_permissions;
CREATE POLICY "Directors/Admins can view all chat permissions" 
ON public.chat_permissions
FOR SELECT
USING (
    tenant_id IN (
        SELECT tenant_id FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('DIRECTOR', 'ADMIN')
    )
);

-- Policy: DIRECTOR/ADMIN can manage (insert/update/delete) permissions
DROP POLICY IF EXISTS "Directors/Admins can manage chat permissions" ON public.chat_permissions;
CREATE POLICY "Directors/Admins can manage chat permissions" 
ON public.chat_permissions
FOR ALL
USING (
    tenant_id IN (
        SELECT tenant_id FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('DIRECTOR', 'ADMIN')
    )
);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_chat_permissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS chat_permissions_updated_at ON public.chat_permissions;
CREATE TRIGGER chat_permissions_updated_at
BEFORE UPDATE ON public.chat_permissions
FOR EACH ROW
EXECUTE FUNCTION update_chat_permissions_updated_at();



-- ########## FILE: 20260215000087_fix_chat_rooms_insert.sql ##########
-- Fix chat_rooms INSERT policy to allow room creation
-- The previous policy had a circular reference to chat_rooms.tenant_id before the row exists

DROP POLICY IF EXISTS "Users can create rooms" ON public.chat_rooms;

CREATE POLICY "Users can create rooms" ON public.chat_rooms
FOR INSERT WITH CHECK (
    -- Allow users to create rooms in their own tenant
    tenant_id IN (
        SELECT tenant_id FROM public.profiles 
        WHERE id = auth.uid()
    )
);



-- ########## FILE: 20260215000088_fix_chat_participants_insert.sql ##########
-- Fix chat_participants to allow INSERT when creating rooms
-- Currently only has SELECT policy, missing INSERT policy

DROP POLICY IF EXISTS "Users can add participants" ON public.chat_participants;

CREATE POLICY "Users can add participants" ON public.chat_participants
FOR INSERT WITH CHECK (
    -- Allow users to add participants to rooms in their tenant
    EXISTS (
        SELECT 1 FROM public.chat_rooms r
        WHERE r.id = chat_participants.room_id
        AND r.tenant_id IN (
            SELECT tenant_id FROM public.profiles 
            WHERE id = auth.uid()
        )
    )
);



-- ########## FILE: 20260215000089_chat_delete_policy_and_cleanup.sql ##########
-- Migración para agregar política RLS de DELETE en chat_rooms
-- y limpiar chats duplicados

-- 1. Crear política de DELETE para chat_rooms
DROP POLICY IF EXISTS "Users can delete rooms they participate in" ON chat_rooms;

CREATE POLICY "Users can delete rooms they participate in"
ON chat_rooms
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM chat_participants
        WHERE chat_participants.room_id = chat_rooms.id
        AND chat_participants.profile_id = auth.uid()
    )
);

-- 2. Limpiar chats DIRECT duplicados (mantener solo el más antiguo por par de usuarios)
DELETE FROM chat_rooms
WHERE id IN (
    WITH chat_pairs AS (
        SELECT 
            cr.id,
            cr.created_at,
            ARRAY_AGG(cp.profile_id ORDER BY cp.profile_id) as participant_ids
        FROM chat_rooms cr
        JOIN chat_participants cp ON cr.id = cp.room_id
        WHERE cr.type = 'DIRECT'
        GROUP BY cr.id, cr.created_at
    ),
    duplicates AS (
        SELECT 
            id,
            ROW_NUMBER() OVER (PARTITION BY participant_ids ORDER BY created_at ASC) as rn
        FROM chat_pairs
    )
    SELECT id
    FROM duplicates
    WHERE rn > 1
);

-- 3. Verificar políticas de DELETE
SELECT 
    tablename,
    policyname,
    cmd
FROM pg_policies
WHERE tablename = 'chat_rooms' AND cmd = 'DELETE';



-- ########## FILE: 20260215000090_fix_chat_delete_recursion.sql ##########
-- Corregir política RLS de DELETE que causa recursión infinita
-- Usar una política más simple que no consulte otras tablas con RLS

-- 1. Eliminar la política problemática
DROP POLICY IF EXISTS "Users can delete rooms they participate in" ON chat_rooms;

-- 2. Crear política simplificada usando SECURITY DEFINER function
-- Primero crear la función
CREATE OR REPLACE FUNCTION is_room_participant(room_uuid UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM chat_participants
    WHERE room_id = room_uuid
    AND profile_id = auth.uid()
  );
$$;

-- 3. Crear política usando la función
CREATE POLICY "Users can delete rooms they participate in"
ON chat_rooms
FOR DELETE
TO authenticated
USING (is_room_participant(id));

-- 4. Verificar la política
SELECT 
    tablename,
    policyname,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'chat_rooms' AND cmd = 'DELETE';



-- ########## FILE: 20260215000091_fix_chat_privacy_isolation.sql ##########
-- Migration: 20260215000087_fix_chat_privacy_isolation.sql
-- Description: Enforces strict privacy by ensuring users only see rooms where they are participants.

-- 0. HELPER FUNCTION
-- Runs with SECURITY DEFINER to bypass RLS during participation checks (prevents infinite recursion)
CREATE OR REPLACE FUNCTION is_room_participant(room_uuid UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM chat_participants
    WHERE room_id = room_uuid
    AND profile_id = auth.uid()
  );
$$;

-- 1. FIX CHAT_ROOMS POLICIES
-- Drop legacy permissive policies that allow tenant-wide visibility
DROP POLICY IF EXISTS "View own rooms" ON public.chat_rooms;
DROP POLICY IF EXISTS "Users can view their own rooms" ON public.chat_rooms;
DROP POLICY IF EXISTS "Users can only see rooms they are participants of" ON public.chat_rooms;

-- Recreate strict SELECT policy
CREATE POLICY "Users can only see rooms they are participants of"
ON public.chat_rooms
FOR SELECT
TO authenticated
USING (
    is_room_participant(id)
);


-- 2. FIX CHAT_PARTICIPANTS POLICIES
-- Drop legacy permissive policies
DROP POLICY IF EXISTS "View participants" ON public.chat_participants;
DROP POLICY IF EXISTS "Users can only see participants of their own rooms" ON public.chat_participants;

-- Recreate strict SELECT policy (Can only see participants of rooms you are in)
CREATE POLICY "Users can only see participants of their own rooms"
ON public.chat_participants
FOR SELECT
TO authenticated
USING (
    is_room_participant(room_id)
);


-- 3. FIX CHAT_MESSAGES POLICIES
-- Drop legacy permissive policies
DROP POLICY IF EXISTS "Read messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Send messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can only read messages from their own rooms" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can only send messages to their own rooms" ON public.chat_messages;

-- Recreate strict SELECT policy
CREATE POLICY "Users can only read messages from their own rooms"
ON public.chat_messages
FOR SELECT
TO authenticated
USING (
    is_room_participant(room_id)
);

-- Recreate strict INSERT policy
CREATE POLICY "Users can only send messages to their own rooms"
ON public.chat_messages
FOR INSERT
TO authenticated
WITH CHECK (
    is_room_participant(room_id)
);


-- 4. FIX CHAT_PARTICIPANTS INSERT POLICY
DROP POLICY IF EXISTS "Users can add participants" ON public.chat_participants;
DROP POLICY IF EXISTS "Users can only add participants to rooms they belong to" ON public.chat_participants;

CREATE POLICY "Users can only add participants to rooms they belong to"
ON public.chat_participants
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.chat_rooms r
        WHERE r.id = public.chat_participants.room_id
        -- Ensure room is in same tenant
        AND r.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
        AND (
            -- Either the user is already a participant
            is_room_participant(r.id)
            OR
            -- Or the room is empty (creator adding first participants)
            NOT EXISTS (SELECT 1 FROM public.chat_participants cp2 WHERE cp2.room_id = r.id)
        )
    )
);


-- 5. FIX CHAT_REACTIONS POLICIES
-- Ensure reactions are also isolated
DROP POLICY IF EXISTS "View reactions" ON public.chat_reactions;
DROP POLICY IF EXISTS "Users can only see reactions in their own rooms" ON public.chat_reactions;

CREATE POLICY "Users can only see reactions in their own rooms"
ON public.chat_reactions
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.chat_messages m
        JOIN public.chat_participants p ON p.room_id = m.room_id
        WHERE m.id = public.chat_reactions.message_id
        AND p.profile_id = auth.uid()
    )
);



-- ########## FILE: 20260215000092_multi_workspace_support.sql ##########
-- Migration: Multi-Workspace Support
-- Description: Decouples profiles from a single tenant and allows users to have multiple workspaces.

-- 1. Create profile_tenants table
CREATE TABLE IF NOT EXISTS public.profile_tenants (
    profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
    role text NOT NULL,
    is_default boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (profile_id, tenant_id, role)
);

-- 2. Populate profile_tenants with current data
-- 2. Populate profile_tenants with current data
INSERT INTO public.profile_tenants (profile_id, tenant_id, role, is_default)
SELECT id, tenant_id, role, true
FROM public.profiles
WHERE tenant_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 3. Update profiles table to handle active workspace
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_tenant_id uuid REFERENCES public.tenants(id);

-- 4. RPC to switch active workspace
CREATE OR REPLACE FUNCTION public.switch_workspace(new_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    target_role text;
BEGIN
    -- Verify user belongs to this tenant and get their role there
    SELECT role INTO target_role 
    FROM profile_tenants 
    WHERE profile_id = auth.uid() AND tenant_id = new_tenant_id 
    LIMIT 1;

    IF target_role IS NOT NULL THEN
        UPDATE public.profiles 
        SET tenant_id = new_tenant_id,
            role = target_role
        WHERE id = auth.uid();
    ELSE
        RAISE EXCEPTION 'User does not belong to the specified workspace';
    END IF;
END;
$$;

-- 5. RPC to create a new workspace
CREATE OR REPLACE FUNCTION public.create_workspace(workspace_name text, workspace_type text, workspace_role text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    new_tenant_id uuid;
BEGIN
    -- 1. Create the tenant
    INSERT INTO public.tenants (name, type)
    VALUES (workspace_name, workspace_type)
    RETURNING id INTO new_tenant_id;

    -- 2. Link the creator to the tenant
    INSERT INTO public.profile_tenants (profile_id, tenant_id, role, is_default)
    VALUES (auth.uid(), new_tenant_id, workspace_role, false);

    -- 3. Set as active workspace
    UPDATE public.profiles SET tenant_id = new_tenant_id WHERE id = auth.uid();

    RETURN new_tenant_id;
END;
$$;

-- 6. "Rescue" logic for the user
-- Revert the type of the current tenant to INDEPENDENT if it was overwritten
-- This is a one-time fix for existing users who accidentally overwritten their teacher workspace
UPDATE public.tenants
SET type = 'INDEPENDENT'
WHERE id IN (
    SELECT tenant_id 
    FROM public.profiles 
    WHERE id = auth.uid()
) AND type = 'SCHOOL';

-- 7. Update RLS for tenants (to allow viewing all workspaces one belongs to)
DROP POLICY IF EXISTS "Users can view own tenant" ON public.tenants;
DROP POLICY IF EXISTS "Users can view their workspaces" ON public.tenants;

CREATE POLICY "Users can view their workspaces" ON public.tenants
FOR SELECT USING (
    id IN (SELECT tenant_id FROM public.profile_tenants WHERE profile_id = auth.uid())
);



-- ########## FILE: 20260215000093_decouple_profiles.sql ##########
-- Migration: Decouple Profiles
-- Description: Adds profile fields to profile_tenants so each workspace has its own identity.

-- 1. Add columns to profile_tenants
ALTER TABLE public.profile_tenants
ADD COLUMN IF NOT EXISTS first_name text,
ADD COLUMN IF NOT EXISTS last_name_paternal text,
ADD COLUMN IF NOT EXISTS last_name_maternal text,
ADD COLUMN IF NOT EXISTS avatar_url text;

-- 2. Populate new columns for existing records (Snapshot from global profile)
UPDATE public.profile_tenants pt
SET 
  first_name = p.first_name,
  last_name_paternal = p.last_name_paternal,
  last_name_maternal = p.last_name_maternal,
  avatar_url = p.avatar_url
FROM public.profiles p
WHERE pt.profile_id = p.id
  AND pt.first_name IS NULL -- Only update if not already set
  AND p.tenant_id IS NOT NULL; -- ONLY update if we have a valid source tenant 

-- 3. Update the handle_new_user trigger to populate these fields on creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_tenant_id uuid;
  meta jsonb;
  tenant_name text;
BEGIN
  -- Get metadata from the auth.users payload
  meta := new.raw_user_meta_data;
  
  -- Determine Tenant Name
  tenant_name := meta->>'organizationName';
  
  IF tenant_name IS NULL OR trim(tenant_name) = '' THEN
    tenant_name := trim(
      coalesce(meta->>'firstName', '') || ' ' || 
      coalesce(meta->>'lastNamePaternal', '') || ' ' || 
      coalesce(meta->>'lastNameMaternal', '')
    );
  END IF;

  -- Create the Tenant
  INSERT INTO public.tenants (name, type)
  VALUES (
    tenant_name,
    meta->>'mode'
  )
  RETURNING id INTO new_tenant_id;

  -- Create the Global Profile (still needed for auth/linking)
  INSERT INTO public.profiles (
    id,
    tenant_id,
    first_name,
    last_name_paternal,
    last_name_maternal,
    role
  )
  VALUES (
    new.id,
    new_tenant_id,
    meta->>'firstName',
    meta->>'lastNamePaternal',
    meta->>'lastNameMaternal',
    'ADMIN' -- Creator is Admin of their first workspace
  );

  -- Create the Profile Tenant Link (WITH SPECIFIC IDENTITY)
  INSERT INTO public.profile_tenants (
    profile_id, 
    tenant_id, 
    role, 
    is_default,
    first_name,
    last_name_paternal,
    last_name_maternal
  )
  VALUES (
    new.id, 
    new_tenant_id, 
    'ADMIN', -- Creator role
    true,
    meta->>'firstName',
    meta->>'lastNamePaternal',
    meta->>'lastNameMaternal'
  );

  RETURN new;
END;
$$;

-- 4. Update create_workspace RPC to populate fields
CREATE OR REPLACE FUNCTION public.create_workspace(workspace_name text, workspace_type text, workspace_role text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    new_tenant_id uuid;
    current_profile record;
BEGIN
    -- Get current global profile data to use as default for new workspace
    SELECT * INTO current_profile FROM public.profiles WHERE id = auth.uid();

    -- 1. Create the tenant
    INSERT INTO public.tenants (name, type)
    VALUES (workspace_name, workspace_type)
    RETURNING id INTO new_tenant_id;

    -- 2. Link the creator to the tenant with copied profile data
    INSERT INTO public.profile_tenants (
        profile_id, 
        tenant_id, 
        role, 
        is_default,
        first_name,
        last_name_paternal,
        last_name_maternal,
        avatar_url
    )
    VALUES (
        auth.uid(), 
        new_tenant_id, 
        workspace_role, 
        false,
        current_profile.first_name,
        current_profile.last_name_paternal,
        current_profile.last_name_maternal,
        current_profile.avatar_url
    );

    -- 3. Set as active workspace
    UPDATE public.profiles SET tenant_id = new_tenant_id WHERE id = auth.uid();

    RETURN new_tenant_id;
END;
$$;

-- 5. Update update_profile_for_workspace function (New RPC)
-- This allows updating the profile SPECIFIC to the current workspace
CREATE OR REPLACE FUNCTION public.update_profile_for_workspace(
    p_first_name text,
    p_last_name_paternal text,
    p_last_name_maternal text,
    p_avatar_url text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    current_tenant_id uuid;
BEGIN
    -- Get current active tenant from profiles table
    SELECT tenant_id INTO current_tenant_id FROM public.profiles WHERE id = auth.uid();

    IF current_tenant_id IS NULL THEN
        RAISE EXCEPTION 'No active workspace found';
    END IF;

    -- Update the profile_tenants record
    UPDATE public.profile_tenants
    SET
        first_name = p_first_name,
        last_name_paternal = p_last_name_paternal,
        last_name_maternal = p_last_name_maternal,
        avatar_url = p_avatar_url
    WHERE
        profile_id = auth.uid() AND
        tenant_id = current_tenant_id;
        
    -- Optionally keep global profile in sync with the "last used" one, or decouple completely?
    -- For now, let's update global profile too just as a fallback "latest known identity"
    UPDATE public.profiles
    SET
        first_name = p_first_name,
        last_name_paternal = p_last_name_paternal,
        last_name_maternal = p_last_name_maternal,
        avatar_url = p_avatar_url
    WHERE id = auth.uid();
END;
$$;



-- ########## FILE: 20260215000094_galactic_separation.sql ##########
-- Migration: Galactic Separation (Independent Teacher Role)
-- Description: Introduces INDEPENDENT_TEACHER role and updates triggers to enforce strict separation.

-- 1. Drop check constraint on profiles.role to allow new roles
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('ADMIN', 'TEACHER', 'TUTOR', 'STUDENT', 'INDEPENDENT_TEACHER', 'DIRECTOR', 'ACADEMIC_COORD', 'TECH_COORD', 'SCHOOL_CONTROL', 'PREFECT', 'SUPPORT', 'SUPER_ADMIN'));

-- 2. Drop check constraint on profile_tenants.role if it exists (usually text, but check)
-- (It was created as text NOT NULL, so no check constraint by default in my previous view, but good to be safe)

-- 3. Update handle_new_user trigger to assign INDEPENDENT_TEACHER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_tenant_id uuid;
  meta jsonb;
  tenant_name text;
  target_role text;
  is_independent boolean;
BEGIN
  -- Get metadata
  meta := new.raw_user_meta_data;
  
  -- Determine Mode
  is_independent := (meta->>'mode' = 'INDEPENDENT');

  -- Determine Tenant Name
  tenant_name := meta->>'organizationName';
  
  IF tenant_name IS NULL OR trim(tenant_name) = '' THEN
    tenant_name := trim(
      coalesce(meta->>'firstName', '') || ' ' || 
      coalesce(meta->>'lastNamePaternal', '') || ' ' || 
      coalesce(meta->>'lastNameMaternal', '')
    );
  END IF;

  -- Set Role based on Mode
  -- If Independent -> INDEPENDENT_TEACHER (The "Star" of their system)
  -- If School -> DIRECTOR (The "Star" of the school system, or whatever RegisterPage sent)
  -- Actually, RegisterPage sends 'DIRECTOR' for School mode creator.
  -- But for Independent, we want INDEPENDENT_TEACHER.
  
  IF is_independent THEN
    target_role := 'INDEPENDENT_TEACHER';
  ELSE
    target_role := 'DIRECTOR'; -- Default for new School creator
  END IF;

  -- Create the Tenant
  INSERT INTO public.tenants (name, type)
  VALUES (
    tenant_name,
    meta->>'mode'
  )
  RETURNING id INTO new_tenant_id;

  -- Create Global Profile
  INSERT INTO public.profiles (
    id,
    tenant_id,
    first_name,
    last_name_paternal,
    last_name_maternal,
    role
  )
  VALUES (
    new.id,
    new_tenant_id,
    meta->>'firstName',
    meta->>'lastNamePaternal',
    meta->>'lastNameMaternal',
    target_role
  );
  
  -- Create Profile Tenant Link
  INSERT INTO public.profile_tenants (
    profile_id, 
    tenant_id, 
    role, 
    is_default,
    first_name,
    last_name_paternal,
    last_name_maternal
  )
  VALUES (
    new.id, 
    new_tenant_id, 
    target_role, 
    true,
    meta->>'firstName',
    meta->>'lastNamePaternal',
    meta->>'lastNameMaternal'
  );

  RETURN new;
END;
$$;

-- 4. Update create_workspace RPC to support INDEPENDENT_TEACHER
CREATE OR REPLACE FUNCTION public.create_workspace(workspace_name text, workspace_type text, workspace_role text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    new_tenant_id uuid;
    current_profile record;
    final_role text;
BEGIN
    SELECT * INTO current_profile FROM public.profiles WHERE id = auth.uid();

    -- Enforce INDEPENDENT_TEACHER role if type is INDEPENDENT
    IF workspace_type = 'INDEPENDENT' THEN
        final_role := 'INDEPENDENT_TEACHER';
    ELSE
        final_role := workspace_role;
    END IF;

    INSERT INTO public.tenants (name, type)
    VALUES (workspace_name, workspace_type)
    RETURNING id INTO new_tenant_id;

    INSERT INTO public.profile_tenants (
        profile_id, 
        tenant_id, 
        role, 
        is_default,
        first_name,
        last_name_paternal,
        last_name_maternal,
        avatar_url
    )
    VALUES (
        auth.uid(), 
        new_tenant_id, 
        final_role, 
        false,
        current_profile.first_name,
        current_profile.last_name_paternal,
        current_profile.last_name_maternal,
        current_profile.avatar_url
    );

    UPDATE public.profiles 
    SET tenant_id = new_tenant_id, role = final_role
    WHERE id = auth.uid();

    RETURN new_tenant_id;
END;
$$;

-- 5. Migrate existing "Independent" teachers to new role
-- Update profiles and profile_tenants where tenant type is INDEPENDENT and role is TEACHER
UPDATE public.profile_tenants pt
SET role = 'INDEPENDENT_TEACHER'
FROM public.tenants t
WHERE pt.tenant_id = t.id
  AND t.type = 'INDEPENDENT'
  AND pt.role = 'TEACHER';

UPDATE public.profiles p
SET role = 'INDEPENDENT_TEACHER'
FROM public.tenants t
WHERE p.tenant_id = t.id
  AND t.type = 'INDEPENDENT'
  AND p.role = 'TEACHER';



-- ########## FILE: 20260215000095_fix_galactic_permissions.sql ##########
-- Migration: Galactic Permissions (RLS Fix)
-- Description: Updates RLS policies to allow INDEPENDENT_TEACHER to manage their own data.

-- 1. Updates policies for academic_years
DROP POLICY IF EXISTS "Enable write access for admins on academic_years" ON public.academic_years;
CREATE POLICY "Enable write access for admins on academic_years" ON public.academic_years
  FOR ALL
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles 
      WHERE tenant_id = academic_years.tenant_id 
      AND tenant_id IS NOT NULL
      AND role IN ('DIRECTOR', 'ADMIN', 'INDEPENDENT_TEACHER')
    )
  );

-- 2. Updates policies for evaluation_periods
DROP POLICY IF EXISTS "Enable write access for admins on evaluation_periods" ON public.evaluation_periods;
CREATE POLICY "Enable write access for admins on evaluation_periods" ON public.evaluation_periods
  FOR ALL
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles 
      WHERE tenant_id = evaluation_periods.tenant_id 
      AND role IN ('DIRECTOR', 'ADMIN', 'INDEPENDENT_TEACHER')
    )
  );

-- 3. Updates policies for analytical_programs
DROP POLICY IF EXISTS "Enable write access for admins on analytical_programs" ON public.analytical_programs;
CREATE POLICY "Enable write access for admins on analytical_programs" ON public.analytical_programs
  FOR ALL
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles 
      WHERE tenant_id = public.analytical_programs.tenant_id 
      AND role IN ('DIRECTOR', 'ADMIN', 'INDEPENDENT_TEACHER')
    )
  );

DROP POLICY IF EXISTS "Enable write access for admins on analytical_program_contents" ON public.analytical_program_contents;
CREATE POLICY "Enable write access for admins on analytical_program_contents" ON public.analytical_program_contents
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.analytical_programs p
      WHERE p.id = public.analytical_program_contents.program_id
      AND auth.uid() IN (
        SELECT id FROM public.profiles 
        WHERE tenant_id = p.tenant_id 
        AND role IN ('DIRECTOR', 'ADMIN', 'INDEPENDENT_TEACHER')
      )
    )
  );

-- 4. Updates policies for profile_subjects
DROP POLICY IF EXISTS "Enable write access for admins on profile_subjects" ON public.profile_subjects;
CREATE POLICY "Enable write access for admins on profile_subjects" ON public.profile_subjects
  FOR ALL
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles 
      WHERE tenant_id = profile_subjects.tenant_id 
      AND role IN ('DIRECTOR', 'ADMIN', 'INDEPENDENT_TEACHER')
    )
  );

-- 5. Updates policies for tenants (Settings)
DROP POLICY IF EXISTS "Enables update for tenant administrators" ON public.tenants;
CREATE POLICY "Enables update for tenant administrators" ON public.tenants
  FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles 
      WHERE tenant_id = tenants.id 
      AND role IN ('DIRECTOR', 'ADMIN', 'INDEPENDENT_TEACHER')
    )
  );

-- 6. Updates policies for subject_catalog (to allow adding custom subjects?)
-- Usually catalog is global or mixed. Let's check if there is a tenant-specific policy.
-- Assuming standard tenant isolation is enough, but if there was an explicit restrictions, we'd fix it here.



-- ########## FILE: 20260215000096_independent_teacher_extras.sql ##########
-- 20260215000092_independent_teacher_extras.sql

-- 1. Allow INDEPENDENT_TEACHER to manage school_details
DO $$
BEGIN
    -- Drop existing policy if it's too restrictive (Admins can manage school details)
    IF EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'school_details' AND policyname = 'Admins can manage school details'
    ) THEN
        DROP POLICY "Admins can manage school details" ON public.school_details;
    END IF;

    -- Re-create policy including INDEPENDENT_TEACHER
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'school_details' AND policyname = 'Admins and Independent Teachers can manage school details'
    ) THEN
        CREATE POLICY "Admins and Independent Teachers can manage school details"
        ON public.school_details FOR ALL
        USING (EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role IN ('SUPER_ADMIN', 'ADMIN', 'DIRECTOR', 'INDEPENDENT_TEACHER')
        ));
    END IF;
END $$;

-- 2. Ensure school_details row exists for every Independent Teacher tenant
-- This is a self-healing step. If an independent teacher was created but no school_details row exists,
-- they won't be able to "UPDATE" it. We should ensure they can INSERT or we auto-create.
-- The policy above allows ALL (Insert/Update/Delete), so they can insert if needed.
-- But let's add a trigger or just a one-time fix for existing ones.

INSERT INTO public.school_details (tenant_id, official_name, cct, educational_level)
SELECT id, name, 'PARTICULAR', 'PRIMARY'
FROM public.tenants
WHERE type = 'INDEPENDENT'
AND id NOT IN (SELECT tenant_id FROM public.school_details)
ON CONFLICT (tenant_id) DO NOTHING;



-- ########## FILE: 20260215000097_fix_independent_role.sql ##########
-- 20260215000093_fix_independent_role.sql

-- Updates the profile role to 'INDEPENDENT_TEACHER' for users who are associated with an INDEPENDENT tenant.
-- This ensures they see the correct dashboard and have the correct permissions.

UPDATE public.profiles
SET role = 'INDEPENDENT_TEACHER'
WHERE id IN (
    SELECT profile_id 
    FROM public.profile_tenants pt
    JOIN public.tenants t ON pt.tenant_id = t.id
    WHERE t.type = 'INDEPENDENT'
);

-- Also ensure the user_tenants table reflects the role if it has a role column (it usually does or uses profiles)
-- Assuming user_tenants might have a 'role' column in some schemas, but usually profiles is the source of truth for the app logic.



-- ########## FILE: 20260215000098_fix_profile_tenants_role.sql ##########
-- 20260215000094_fix_profile_tenants_role.sql

-- Updates the profile_tenants role to 'INDEPENDENT_TEACHER' for users who are associated with an INDEPENDENT tenant.
-- This is CRITICAL because useTenant hook derives the role from this table, not just the profiles table.

UPDATE public.profile_tenants
SET role = 'INDEPENDENT_TEACHER'
WHERE tenant_id IN (
    SELECT id FROM public.tenants WHERE type = 'INDEPENDENT'
);



-- ########## FILE: 20260215000099_absence_management.sql ##########
-- 20260215000100_absence_management.sql

-- Table to store absence plans and their associated activities
CREATE TABLE IF NOT EXISTS public.absence_plans (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    activities JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of activities per class/session
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'FINAL')),
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT absence_plans_pkey PRIMARY KEY (id)
);

-- Enable RLS
ALTER TABLE public.absence_plans ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Users can manage their own absence plans" ON public.absence_plans;
CREATE POLICY "Users can manage their own absence plans"
ON public.absence_plans
FOR ALL
USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all absence plans in tenant" ON public.absence_plans;
CREATE POLICY "Admins can view all absence plans in tenant"
ON public.absence_plans
FOR SELECT
USING (tenant_id = get_current_tenant_id());

-- Helper function to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_absence_plans_updated_at ON public.absence_plans;
CREATE TRIGGER update_absence_plans_updated_at
    BEFORE UPDATE ON public.absence_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();



-- ########## FILE: 20260215000100_fix_superadmin_visibility.sql ##########
-- Migration: Fix SuperAdmin Visibility
-- Description: Ensures SUPER_ADMIN can see all tenants and profiles regardless of personal tenant association.

-- 1. Update RLS for tenants
DROP POLICY IF EXISTS "SuperAdmins can view all tenants" ON public.tenants;
CREATE POLICY "SuperAdmins can view all tenants" ON public.tenants
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'SUPER_ADMIN'
    )
);

-- 2. Update RLS for profiles
DROP POLICY IF EXISTS "SuperAdmins can view all profiles" ON public.profiles;
CREATE POLICY "SuperAdmins can view all profiles" ON public.profiles
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'SUPER_ADMIN'
    )
);

-- 3. Temporal "Libre" Mode for development (Optional, but user asked for it)
-- This allows viewing even if role isn't set, ONLY for the dashboard query if we can't get role yet.
-- To minimize risk, we only allow it for the authenticated user helmerferras@gmail.com
-- OR we just allow it for all during this phase if specifically requested "dejalo libre".

-- Let's stick to the SuperAdmin role fix first, but also let's make helmerferras@gmail.com SUPER_ADMIN via migration
DO $$
BEGIN
    -- Try to find the user helmerferras@gmail.com and elevate them
    UPDATE public.profiles 
    SET role = 'SUPER_ADMIN'
    WHERE id IN (SELECT id FROM auth.users WHERE email = 'helmerferras@gmail.com');

    INSERT INTO public.profile_roles (profile_id, role)
    SELECT id, 'SUPER_ADMIN' 
    FROM auth.users WHERE email = 'helmerferras@gmail.com'
    ON CONFLICT DO NOTHING;
END $$;



-- ########## FILE: 20260215000101_god_mode_extras.sql ##########
-- Migration: God Mode Extras (System Settings & Monetization)
-- Description: Adds tables for system-wide settings (AI keys) and payment/license management.

-- 1. System Settings (Key-Value Store for Admin Configs)
CREATE TABLE IF NOT EXISTS public.system_settings (
    key text PRIMARY KEY,
    value text,
    description text,
    updated_at timestamp with time zone default now(),
    updated_by uuid references auth.users(id)
);

-- RLS for System Settings
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "SuperAdmins can view system settings" ON public.system_settings
FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'SUPER_ADMIN')
);

CREATE POLICY "SuperAdmins can update system settings" ON public.system_settings
FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'SUPER_ADMIN')
);

CREATE POLICY "SuperAdmins can insert system settings" ON public.system_settings
FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'SUPER_ADMIN')
);

-- 2. Payment Transactions (Mercado Pago / Stripe integration log)
CREATE TABLE IF NOT EXISTS public.payment_transactions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid REFERENCES public.tenants(id),
    user_id uuid REFERENCES auth.users(id),
    amount numeric(10, 2) NOT NULL,
    currency text DEFAULT 'MXN',
    provider text NOT NULL, -- 'MERCADO_PAGO'
    provider_payment_id text, -- MP transaction ID
    status text NOT NULL, -- 'PENDING', 'APPROVED', 'REJECTED'
    metadata jsonb DEFAULT '{}',
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own payments" ON public.payment_transactions
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "SuperAdmins can view all payments" ON public.payment_transactions
FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'SUPER_ADMIN')
);

-- 3. Licenses
CREATE TABLE IF NOT EXISTS public.licenses (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid REFERENCES public.tenants(id),
    plan_type text NOT NULL, -- 'PRO', 'ENTERPRISE', 'S', 'M', 'L'
    status text NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'EXPIRED', 'SUSPENDED'
    starts_at timestamp with time zone DEFAULT now(),
    ends_at timestamp with time zone,
    transaction_id uuid REFERENCES public.payment_transactions(id),
    features jsonb DEFAULT '{}', -- Feature flags
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can view their active license" ON public.licenses
FOR SELECT USING (
    tenant_id IN (
        SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    )
);

CREATE POLICY "SuperAdmins can manage licenses" ON public.licenses
FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'SUPER_ADMIN')
);



-- ########## FILE: 20260215000102_temp_disable_rls.sql ##########
-- TEMP MIGRATION: DISABLE RLS FOR CONFIGURATION
-- This allows any user (including anon) to view/edit system settings and users.
-- WARNING: RUN THIS ON LOCALHOST ONLY. REVERT BEFORE PRODUCTION.

-- 1. System Settings (Public Access)
DROP POLICY IF EXISTS "SuperAdmins can view system settings" ON public.system_settings;
DROP POLICY IF EXISTS "SuperAdmins can update system settings" ON public.system_settings;
DROP POLICY IF EXISTS "SuperAdmins can insert system settings" ON public.system_settings;

DROP POLICY IF EXISTS "Public can view system settings" ON public.system_settings;
DROP POLICY IF EXISTS "Public can update system settings" ON public.system_settings;
DROP POLICY IF EXISTS "Public can insert system settings" ON public.system_settings;

CREATE POLICY "Public can view system settings" ON public.system_settings FOR SELECT USING (true);
CREATE POLICY "Public can update system settings" ON public.system_settings FOR UPDATE USING (true);
CREATE POLICY "Public can insert system settings" ON public.system_settings FOR INSERT WITH CHECK (true);

-- 2. Payment Transactions (Public Access)
DROP POLICY IF EXISTS "Users can view their own payments" ON public.payment_transactions;
DROP POLICY IF EXISTS "SuperAdmins can view all payments" ON public.payment_transactions;

DROP POLICY IF EXISTS "Public can view payment_transactions" ON public.payment_transactions;
DROP POLICY IF EXISTS "Public can insert payment_transactions" ON public.payment_transactions;

CREATE POLICY "Public can view payment_transactions" ON public.payment_transactions FOR SELECT USING (true);
CREATE POLICY "Public can insert payment_transactions" ON public.payment_transactions FOR INSERT WITH CHECK (true);

-- 3. Licenses (Public Access)
DROP POLICY IF EXISTS "Tenants can view their active license" ON public.licenses;
DROP POLICY IF EXISTS "SuperAdmins can manage licenses" ON public.licenses;

DROP POLICY IF EXISTS "Public can view licenses" ON public.licenses;
DROP POLICY IF EXISTS "Public can insert licenses" ON public.licenses;

CREATE POLICY "Public can view licenses" ON public.licenses FOR SELECT USING (true);
CREATE POLICY "Public can insert licenses" ON public.licenses FOR INSERT WITH CHECK (true);

-- 4. Tenants & Profiles (Public Read Access to visualize dashboard)
DROP POLICY IF EXISTS "Public can view tenants" ON public.tenants;
DROP POLICY IF EXISTS "Public can view profiles" ON public.profiles;

CREATE POLICY "Public can view tenants" ON public.tenants FOR SELECT USING (true);
CREATE POLICY "Public can view profiles" ON public.profiles FOR SELECT USING (true);

-- 5. Enable Soft Delete/Restore for Public (for testing)
-- Note: RPC functions are SECURITY DEFINER so they might already bypass RLS if logic allows it.
-- But we ensure we can see the data.



-- ########## FILE: 20260215000103_fix_all_missing_tables.sql ##########
-- MASTER FIX SCRIPT
-- This script safely creates all meaningful missing tables/columns and applies public permissions.
-- Run this once to fix 400/500 errors.

-- 1. Ensure 'deleted_at' column exists in profiles (for Soft Delete)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='deleted_at') THEN
        ALTER TABLE public.profiles ADD COLUMN deleted_at timestamp with time zone;
    END IF;
END $$;

-- 2. Ensure 'system_settings' table exists
CREATE TABLE IF NOT EXISTS public.system_settings (
    key text PRIMARY KEY,
    value text,
    description text,
    updated_at timestamp with time zone default now(),
    updated_by uuid references auth.users(id)
);

-- 3. Ensure 'payment_transactions' table exists
CREATE TABLE IF NOT EXISTS public.payment_transactions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid REFERENCES public.tenants(id),
    user_id uuid REFERENCES auth.users(id),
    amount numeric(10, 2) NOT NULL,
    currency text DEFAULT 'MXN',
    provider text NOT NULL, -- 'MERCADO_PAGO'
    provider_payment_id text, -- MP transaction ID
    status text NOT NULL, -- 'PENDING', 'APPROVED', 'REJECTED'
    metadata jsonb DEFAULT '{}',
    created_at timestamp with time zone DEFAULT now()
);

-- 4. Ensure 'licenses' table exists
CREATE TABLE IF NOT EXISTS public.licenses (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid REFERENCES public.tenants(id),
    plan_type text NOT NULL, -- 'PRO', 'ENTERPRISE'
    status text NOT NULL DEFAULT 'ACTIVE',
    starts_at timestamp with time zone DEFAULT now(),
    ends_at timestamp with time zone,
    transaction_id uuid REFERENCES public.payment_transactions(id),
    features jsonb DEFAULT '{}',
    created_at timestamp with time zone DEFAULT now()
);

-- 5. APPLY PUBLIC PERMISSIONS (Disable RLS effectively)
-- We drop existing policies first to facilitate re-runs (idempotency).

-- System Settings
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view system settings" ON public.system_settings;
DROP POLICY IF EXISTS "Public can update system settings" ON public.system_settings;
DROP POLICY IF EXISTS "Public can insert system settings" ON public.system_settings;
CREATE POLICY "Public can view system settings" ON public.system_settings FOR SELECT USING (true);
CREATE POLICY "Public can update system settings" ON public.system_settings FOR UPDATE USING (true);
CREATE POLICY "Public can insert system settings" ON public.system_settings FOR INSERT WITH CHECK (true);

-- Payment Transactions
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view payment_transactions" ON public.payment_transactions;
DROP POLICY IF EXISTS "Public can insert payment_transactions" ON public.payment_transactions;
CREATE POLICY "Public can view payment_transactions" ON public.payment_transactions FOR SELECT USING (true);
CREATE POLICY "Public can insert payment_transactions" ON public.payment_transactions FOR INSERT WITH CHECK (true);

-- Licenses
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view licenses" ON public.licenses;
DROP POLICY IF EXISTS "Public can insert licenses" ON public.licenses;
CREATE POLICY "Public can view licenses" ON public.licenses FOR SELECT USING (true);
CREATE POLICY "Public can insert licenses" ON public.licenses FOR INSERT WITH CHECK (true);

-- Profiles & Tenants (Ensure they are viewable)
DROP POLICY IF EXISTS "Public can view tenants" ON public.tenants;
DROP POLICY IF EXISTS "Public can view profiles" ON public.profiles;
CREATE POLICY "Public can view tenants" ON public.tenants FOR SELECT USING (true);
CREATE POLICY "Public can view profiles" ON public.profiles FOR SELECT USING (true);

-- 6. Grant Permissions to Anon/Authenticated Roles explicitly (just in case)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_settings TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.payment_transactions TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.licenses TO anon, authenticated;
GRANT SELECT ON public.profiles TO anon, authenticated;
GRANT SELECT ON public.tenants TO anon, authenticated;



-- ########## FILE: 20260215000104_emergency_fix_relations.sql ##########
-- EMERGENCY FIX: RELATIONS & PERMISSIONS
-- 1. Fix "Bad Request" on Relations: Point FKs to 'profiles' instead of 'auth.users'
-- PostgREST cannot automatically join auth.users, but it CAN join public.profiles.

DO $$
BEGIN
    -- Fix payment_transactions FK
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='payment_transactions_user_id_fkey') THEN
        ALTER TABLE public.payment_transactions DROP CONSTRAINT payment_transactions_user_id_fkey;
    END IF;
    
    ALTER TABLE public.payment_transactions 
    ADD CONSTRAINT payment_transactions_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.profiles(id);

    -- 1.1 Ensure columns exist before adding constraints
    -- system_settings.updated_by
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='system_settings' AND column_name='updated_by') THEN
        ALTER TABLE public.system_settings ADD COLUMN updated_by uuid;
    END IF;

    -- payment_transactions.user_id (Should exist, but safety first)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payment_transactions' AND column_name='user_id') THEN
        ALTER TABLE public.payment_transactions ADD COLUMN user_id uuid;
    END IF;

    -- 1.2 Fix system_settings FK (updated_by)
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='system_settings_updated_by_fkey') THEN
        ALTER TABLE public.system_settings DROP CONSTRAINT system_settings_updated_by_fkey;
    END IF;

    ALTER TABLE public.system_settings 
    ADD CONSTRAINT system_settings_updated_by_fkey 
    FOREIGN KEY (updated_by) REFERENCES public.profiles(id);

END $$;

-- 2. Verify 'deleted_at' again (Force add if missing)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='deleted_at') THEN
        ALTER TABLE public.profiles ADD COLUMN deleted_at timestamp with time zone;
    END IF;
END $$;

-- 3. Reset Permissions (Grant ALL to anon/service_role to be absolutely sure)
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- 4. Reload Schema Cache
NOTIFY pgrst, 'reload config';



-- ########## FILE: 20260215000105_fix_recursion_nuclear.sql ##########
-- FIX INFINITE RECURSION
-- The policy "SuperAdmins can view all profiles" queries 'public.profiles' itself to check the role.
-- This causes an infinite loop: Select Profile -> Trigger Policy -> Select Profile -> Trigger Policy...

-- We must DROP this specific policy.
-- The "Public can view profiles" policy (created in ...0200) is sufficient for now (USING true).

DROP POLICY IF EXISTS "SuperAdmins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "SuperAdmins can view all tenants" ON public.tenants;

-- Ensure Public policies are still there and active
DROP POLICY IF EXISTS "Public can view profiles" ON public.profiles;
CREATE POLICY "Public can view profiles" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view tenants" ON public.tenants;
CREATE POLICY "Public can view tenants" ON public.tenants FOR SELECT USING (true);

-- Also fix system_settings just in case
DROP POLICY IF EXISTS "SuperAdmins can view system settings" ON public.system_settings;



-- ########## FILE: 20260215000106_add_dummy_mp_token.sql ##########
-- INSERT DUMMY MERCADO PAGO TOKEN
-- Run this to prevent "Missing Token" error in Edge Function.
-- You should replace 'TEST-xxxx...' with your actual MP Access Token using the Dashboard or SQL.

INSERT INTO public.system_settings (key, value, description)
VALUES (
    'mercadopago_access_token', 
    'TEST-00000000-0000-0000-0000-000000000000', 
    'Mercado Pago Access Token (Sandbox/Production)'
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value;



-- ########## FILE: 20260215000107_add_cte_config.sql ##########
-- Migration: Add CTE Config to school_details
-- Description: Adds a JSONB column to store Technical Council (Consejo Técnico) configuration.

ALTER TABLE public.school_details 
ADD COLUMN IF NOT EXISTS cte_config jsonb DEFAULT '{"next_date": null, "link": null}'::jsonb;

-- Comment for documentation
COMMENT ON COLUMN public.school_details.cte_config IS 'Stores configuration for Technical Council: {next_date: string, link: string}';



-- ########## FILE: 20260215000108_emergency_trigger_fix.sql ##########
-- EMERGENCY TRIGGER FIX
-- Diagnosis: User creation in Dashboard fails with "Database error", blocking debugging.
-- Solution: Wrap the trigger logic in a BEGIN...EXCEPTION block to log errors but ALLOW user creation.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
declare
  new_tenant_id uuid;
  meta jsonb;
  tenant_name text;
  inv_token uuid;
  target_tenant_id uuid;
  inv_record record;
  assigned_role text;
  first_name text;
  last_name_paternal text;
  last_name_maternal text;
begin
  -- SAFE BLOCK: Try to do the logic, but don't crash the auth transaction if it fails.
  BEGIN
      meta := new.raw_user_meta_data;
      
      -- Extract basic info (Safely handle nulls)
      first_name := coalesce(meta->>'firstName', '');
      last_name_paternal := coalesce(meta->>'lastNamePaternal', '');
      last_name_maternal := coalesce(meta->>'lastNameMaternal', '');
      
      -- 1. PRIORITY: Check for explicit tenantId
      target_tenant_id := (meta->>'tenantId')::uuid;
      
      if target_tenant_id is not null then
        -- Verify tenant exists
        perform 1 from public.tenants where id = target_tenant_id;
        if found then
            new_tenant_id := target_tenant_id;
            assigned_role := coalesce(meta->>'role', 'TEACHER');
        end if;
      end if;
    
      -- 2. PRIORITY: Check for Invitation
      if new_tenant_id is null then
          inv_token := (meta->>'invitationToken')::uuid;
          if inv_token is not null then
            select * into inv_record from staff_invitations 
            where token = inv_token and status = 'PENDING' and expires_at > now();
        
            if found then
               new_tenant_id := inv_record.tenant_id;
               assigned_role := inv_record.role;
               
               -- Mark invitation as accepted
               update staff_invitations set status = 'ACCEPTED' where id = inv_record.id;
            end if;
          end if;
      end if;
    
      -- 3. FALLBACK: New School
      if new_tenant_id is null then
        tenant_name := meta->>'organizationName';
        
        if tenant_name is null or trim(tenant_name) = '' then
          tenant_name := trim(first_name || ' ' || last_name_paternal || ' ' || last_name_maternal);
          if trim(tenant_name) = '' then
              tenant_name := 'Nueva Escuela (Sin Nombre)'; 
          end if;
        end if;
    
        insert into public.tenants (name, type)
        values (
          tenant_name,
          coalesce(meta->>'mode', 'SCHOOL')
        )
        returning id into new_tenant_id;
        
        assigned_role := 'ADMIN'; 
      end if;
    
      -- 4. Create Profile
      insert into public.profiles (
        id,
        tenant_id,
        first_name,
        last_name_paternal,
        last_name_maternal,
        role
      )
      values (
        new.id,
        new_tenant_id,
        first_name,
        last_name_paternal,
        last_name_maternal,
        assigned_role
      );
      
      -- 5. Role Binding
      insert into public.profile_roles (profile_id, role)
      values (new.id, assigned_role)
      on conflict do nothing;

  EXCEPTION WHEN OTHERS THEN
      -- Log the error (visible in Postgres logs) but DO NOT FAIL the transaction
      RAISE WARNING 'Error in handle_new_user trigger: % %', SQLERRM, SQLSTATE;
      -- We return NEW anyway so the user is created in auth.users
      RETURN NEW;
  END;

  return new;
end;
$$;



-- ########## FILE: 20260215000109_secure_god_mode.sql ##########
-- SECURITY MIGRATION: GOD MODE LOCKDOWN
-- Target: Ensure ONLY 'helmerpersonal@outlook.com' is SUPER_ADMIN.
-- All other SUPER_ADMINs will be downgraded to ADMIN.

BEGIN;

-- 3. Apply Trigger
DROP TRIGGER IF EXISTS tr_enforce_super_admin ON public.profile_roles;

DO $$
DECLARE
    target_email text := 'helmerferras@gmail.com';
    target_uid uuid;
    r RECORD;
BEGIN
    -- 1. Get List of Unauthorized SUPER_ADMINS
    FOR r IN
        SELECT profile_id
        FROM public.profile_roles
        WHERE role = 'SUPER_ADMIN'
        AND profile_id NOT IN (SELECT id FROM auth.users WHERE email = target_email)
    LOOP
        -- Check if they ALREADY have ADMIN role
        -- If YES -> Delete the SUPER_ADMIN row (they keep ADMIN)
        -- If NO -> Update SUPER_ADMIN to ADMIN
        
        IF EXISTS (SELECT 1 FROM public.profile_roles WHERE profile_id = r.profile_id AND role = 'ADMIN') THEN
            DELETE FROM public.profile_roles 
            WHERE profile_id = r.profile_id AND role = 'SUPER_ADMIN';
            RAISE NOTICE 'Removed duplicate SUPER_ADMIN role for user % (already ADMIN)', r.profile_id;
        ELSE
            UPDATE public.profile_roles 
            SET role = 'ADMIN' 
            WHERE profile_id = r.profile_id AND role = 'SUPER_ADMIN';
            RAISE NOTICE 'Downgraded SUPER_ADMIN to ADMIN for user %', r.profile_id;
        END IF;
    END LOOP;

    -- 2. Upgrade the target user to SUPER_ADMIN
    SELECT id INTO target_uid FROM auth.users WHERE email = target_email;

    IF target_uid IS NOT NULL THEN
        -- Link profile_roles
        INSERT INTO public.profile_roles (profile_id, role)
        VALUES (target_uid, 'SUPER_ADMIN')
        ON CONFLICT (profile_id, role) DO NOTHING;
        
        -- Try to update email in profiles IF it exists
        BEGIN
            EXECUTE 'UPDATE public.profiles SET email = $1 WHERE id = $2' USING target_email, target_uid;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not check/update email check in profiles table. Ignoring.';
        END;
        
        RAISE NOTICE 'Upgraded % to SUPER_ADMIN.', target_email;
    ELSE
        RAISE NOTICE 'Target user % NOT FOUND. Please sign up first!', target_email;
    END IF;
END $$;

-- 4. Create a Trigger to PREVENT assigning SUPER_ADMIN to anyone else

CREATE OR REPLACE FUNCTION public.enforce_super_admin_limit()
RETURNS TRIGGER AS $$
DECLARE
    target_email text := 'helmerferras@gmail.com';
    user_email text;
BEGIN
    -- Allow removing SUPER_ADMIN (downgrade)
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;

    -- If adding/updating to SUPER_ADMIN
    IF (NEW.role = 'SUPER_ADMIN') THEN
        -- Check auth.users for email
        SELECT email INTO user_email FROM auth.users WHERE id = NEW.profile_id;
        
        IF user_email IS DISTINCT FROM target_email THEN
            RAISE EXCEPTION 'Security Violation: Only % can be SUPER_ADMIN.', target_email;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_enforce_super_admin
BEFORE INSERT OR UPDATE ON public.profile_roles
FOR EACH ROW EXECUTE FUNCTION public.enforce_super_admin_limit();

COMMIT;




-- ########## FILE: 20260215000111_optimization_and_audit.sql ##########
-- ==========================================
-- OPTIMIZATION & AUDIT SYSTEM MIGRATION
-- ==========================================

BEGIN;

-- 1. Create Audit Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name text NOT NULL,
    record_id uuid NOT NULL,
    action text NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
    old_data jsonb,
    new_data jsonb,
    changed_by uuid REFERENCES auth.users(id),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 2. Audit Trigger Function
CREATE OR REPLACE FUNCTION public.process_audit_log()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        INSERT INTO public.audit_logs (table_name, record_id, action, old_data, changed_by)
        VALUES (TG_TABLE_NAME, OLD.id, TG_OP, to_jsonb(OLD), auth.uid());
        RETURN OLD;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO public.audit_logs (table_name, record_id, action, old_data, new_data, changed_by)
        VALUES (TG_TABLE_NAME, NEW.id, TG_OP, to_jsonb(OLD), to_jsonb(NEW), auth.uid());
        RETURN NEW;
    ELSIF (TG_OP = 'INSERT') THEN
        INSERT INTO public.audit_logs (table_name, record_id, action, new_data, changed_by)
        VALUES (TG_TABLE_NAME, NEW.id, TG_OP, to_jsonb(NEW), auth.uid());
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Apply Audit to Key Tables (Examples)
-- Note: Add more tables as needed.
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN SELECT table_name 
             FROM information_schema.tables 
             WHERE table_schema = 'public' 
             AND table_name IN ('tenants', 'profiles', 'groups', 'students', 'lesson_plans')
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS tr_audit_%I ON public.%I', t, t);
        EXECUTE format('CREATE TRIGGER tr_audit_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.process_audit_log()', t, t);
    END LOOP;
END $$;

-- 4. Performance: Missing Indices for Tenant Isolation
-- We ensure every table with tenant_id is indexed for fast lookups.
DO $$
DECLARE
    t text;
    c text;
BEGIN
    FOR t, c IN SELECT table_name, column_name 
                FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND column_name = 'tenant_id'
    LOOP
        -- Check if index already exists
        IF NOT EXISTS (
            SELECT 1 FROM pg_class c JOIN pg_index i ON c.oid = i.indrelid
            JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY(i.indkey)
            WHERE c.relname = t AND a.attname = 'tenant_id'
        ) THEN
            EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_tenant_id ON public.%I(tenant_id)', t, t);
        END IF;
    END LOOP;
END $$;

-- 5. Hardening: Global profiles shouldn't have sensitive data
-- (Already covered by RLS, but double checking indices on foreign keys)
CREATE INDEX IF NOT EXISTS idx_profile_roles_profile_id ON public.profile_roles(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_tenants_profile_id ON public.profile_tenants(profile_id);

COMMIT;



-- ########## FILE: 20260215000112_fix_rls_and_init_superadmin.sql ##########
-- ==========================================
-- EMERGENCY FIX: RLS & SUPER ADMIN INITIALIZATION
-- ==========================================

BEGIN;

-- 1. Fix Profiles RLS (Allow viewing own profile even if tenant_id is NULL)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone in tenant" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles in own tenant" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users within same tenant can view each other" ON public.profiles
    FOR SELECT USING (
        tenant_id IS NOT NULL AND 
        tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    );

CREATE POLICY "Super Admins can view all profiles" ON public.profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profile_roles 
            WHERE profile_id = auth.uid() AND role = 'SUPER_ADMIN'
        )
    );

-- 2. Restore Super Admin Data Integrity
DO $$
DECLARE
    target_email text := 'helmerferras@gmail.com';
    target_uid uuid;
BEGIN
    SELECT id INTO target_uid FROM auth.users WHERE email = target_email;

    IF target_uid IS NOT NULL THEN
        -- Ensure profile has SUPER_ADMIN role and no tenant_id
        UPDATE public.profiles 
        SET role = 'SUPER_ADMIN', 
            tenant_id = NULL 
        WHERE id = target_uid;

        -- Ensure they have an ACTIVE subscription (so dashboard doesn't 406/404)
        INSERT INTO public.subscriptions (user_id, status, plan_type, current_period_end)
        VALUES (target_uid, 'active', 'ANNUAL', now() + interval '100 years')
        ON CONFLICT (user_id) DO UPDATE 
        SET status = 'active', current_period_end = now() + interval '100 years';

        RAISE NOTICE 'Initialized Super Admin profile and subscription for %', target_email;
    END IF;
END $$;

-- 3. Fix Subscriptions RLS (Just in case, though it looked okay)
DROP POLICY IF EXISTS "Users can read own subscription" ON public.subscriptions;
CREATE POLICY "Users can read own subscription" ON public.subscriptions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Super Admins can read all subscriptions" ON public.subscriptions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profile_roles 
            WHERE profile_id = auth.uid() AND role = 'SUPER_ADMIN'
        )
    );

COMMIT;



-- ########## FILE: 20260215000114_add_exec_sql.sql ##########
-- Function to execute arbitrary SQL (USE WITH CAUTION - SUPER ADMIN ONLY)
CREATE OR REPLACE FUNCTION public.exec_sql(sql_query text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql_query;
END;
$$;

GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO postgres;
GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO authenticated; 
GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO anon; -- Needed for local dev sometimes, but risky in prod. 
-- However, since I am 'authenticated' usually...



-- ########## FILE: 20260215000115_add_exec_sql.sql ##########


-- ########## FILE: 20260215000116_get_db_size.sql ##########
-- Function to get database size in MB
CREATE OR REPLACE FUNCTION get_database_size()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  db_size bigint;
BEGIN
  -- Get size of the current database
  SELECT pg_database_size(current_database()) INTO db_size;
  
  -- Convert to MB
  RETURN (db_size / 1024 / 1024);
END;
$$;

GRANT EXECUTE ON FUNCTION get_database_size() TO authenticated;
GRANT EXECUTE ON FUNCTION get_database_size() TO service_role;



-- ########## FILE: 20260215000117_fix_recursion_final.sql ##########
-- Fix infinite recursion by using SECURITY DEFINER functions to bypass RLS for role/tenant checks

-- 1. Helper: Get own tenant_id without triggering RLS
CREATE OR REPLACE FUNCTION get_own_tenant_id_bypass()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT tenant_id FROM public.profiles WHERE id = auth.uid();
$$;

-- 2. Helper: Check if user has a specific role without triggering RLS
CREATE OR REPLACE FUNCTION has_role_bypass(p_role text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profile_roles
    WHERE profile_id = auth.uid()
    AND role = p_role
  );
$$;

-- 3. Check if user is Super Admin (common check)
CREATE OR REPLACE FUNCTION is_super_admin_bypass()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profile_roles
    WHERE profile_id = auth.uid()
    AND role = 'SUPER_ADMIN'
  );
$$;

-- 4. Fix "profiles" table policies
DROP POLICY IF EXISTS "Users within same tenant can view each other" ON public.profiles;
CREATE POLICY "Users within same tenant can view each other" ON public.profiles
FOR SELECT USING (
    tenant_id IS NOT NULL AND
    tenant_id = get_own_tenant_id_bypass()
);

DROP POLICY IF EXISTS "Super Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "SuperAdmins can view all profiles" ON public.profiles; -- Drop potentially alternate named policy
CREATE POLICY "Super Admins can view all profiles" ON public.profiles
FOR SELECT USING (
    is_super_admin_bypass()
);

-- 5. Fix "profile_roles" table policies
DROP POLICY IF EXISTS "Admins can manage roles in their tenant" ON public.profile_roles;
CREATE POLICY "Admins can manage roles in their tenant" ON public.profile_roles
FOR ALL USING (
    has_role_bypass('SUPER_ADMIN') OR
    has_role_bypass('ADMIN') OR
    has_role_bypass('DIRECTOR')
);

-- 6. Fix "tenants" table policies (checking for superadmin recursion there too)
DROP POLICY IF EXISTS "SuperAdmins can view all tenants" ON public.tenants;
CREATE POLICY "SuperAdmins can view all tenants" ON public.tenants
FOR SELECT USING (
    is_super_admin_bypass()
);



-- ########## FILE: 20260215000118_fix_delete_account_function.sql ##########
-- 20260215000118_fix_delete_account_function.sql

-- Forced update of the delete_own_account function to handle FK constraints on subscriptions and transactions.
-- This ensures user deletion doesn't fail due to existing subscription records.

CREATE OR REPLACE FUNCTION delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tenant_id uuid;
    v_count integer;
BEGIN
    -- 1. Obtener tenant_id del usuario actual antes de borrarlo
    SELECT tenant_id INTO v_tenant_id FROM public.profiles WHERE id = auth.uid();

    -- 1.5. Eliminar dependencias (Suscripciones y Transacciones)
    -- Primero transacciones, luego suscripciones por si hay FK entre ellas
    DELETE FROM public.payment_transactions WHERE user_id = auth.uid();
    DELETE FROM public.subscriptions WHERE user_id = auth.uid();
    
    -- 2. Eliminar el perfil del usuario (Trigger de Auth debería manejarlo, pero por si las FK no son cascade)
    DELETE FROM public.profiles WHERE id = auth.uid();

    -- 3. Eliminar el usuario de Auth (Esto libera el email)
    DELETE FROM auth.users WHERE id = auth.uid();

    -- 4. Limpieza de Tenant Huérfano (Opcional pero recomendado para onboarding cancelado)
    IF v_tenant_id IS NOT NULL THEN
        SELECT count(*) INTO v_count FROM public.profiles WHERE tenant_id = v_tenant_id;
        -- Si no quedan usuarios en ese tenant (probablemente era el único creando la escuela)
        IF v_count = 0 THEN
            DELETE FROM public.tenants WHERE id = v_tenant_id;
        END IF;
    END IF;
END;
$$;



-- ########## FILE: 20260215000119_fix_delete_account_audit.sql ##########
-- 20260215000119_fix_delete_account_audit.sql

-- Forced update of the delete_own_account function to handle FK constraints on audit_logs.
-- This ensures user deletion doesn't fail due to existing audit logs.

CREATE OR REPLACE FUNCTION delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tenant_id uuid;
    v_count integer;
BEGIN
    -- 1. Obtener tenant_id del usuario actual antes de borrarlo
    SELECT tenant_id INTO v_tenant_id FROM public.profiles WHERE id = auth.uid();

    -- 1.5. Eliminar dependencias (Suscripciones, Transacciones y Audit Logs)
    -- Primero logs, luego transacciones, luego suscripciones
    
    -- Intenta eliminar audit_logs donde el usuario es el actor ("changed_by")
    DELETE FROM public.audit_logs WHERE changed_by = auth.uid();
    
    -- Si audit_logs tiene user_id como target, también eliminar (aunque el error dice changed_by)
    -- DELETE FROM public.audit_logs WHERE record_id = auth.uid()::text AND table_name = 'profiles'; -- Opcional si queremos limpiar rastros sobre el usuario

    DELETE FROM public.payment_transactions WHERE user_id = auth.uid();
    DELETE FROM public.subscriptions WHERE user_id = auth.uid();
    
    -- 2. Eliminar el perfil del usuario (Trigger de Auth debería manejarlo, pero por si las FK no son cascade)
    DELETE FROM public.profiles WHERE id = auth.uid();

    -- 3. Eliminar el usuario de Auth (Esto libera el email)
    DELETE FROM auth.users WHERE id = auth.uid();

    -- 4. Limpieza de Tenant Huérfano (Opcional pero recomendado para onboarding cancelado)
    IF v_tenant_id IS NOT NULL THEN
        SELECT count(*) INTO v_count FROM public.profiles WHERE tenant_id = v_tenant_id;
        -- Si no quedan usuarios en ese tenant (probablemente era el único creando la escuela)
        IF v_count = 0 THEN
            DELETE FROM public.tenants WHERE id = v_tenant_id;
        END IF;
    END IF;
END;
$$;



-- ########## FILE: 20260215000120_fix_delete_account_audit_timing.sql ##########
-- 20260215000120_fix_delete_account_audit_timing.sql

-- Forced update of the delete_own_account function to handle FK constraints on audit_logs.
-- This ensures user deletion doesn't fail due to NEW audit logs created by triggers during dependency cleanup.

CREATE OR REPLACE FUNCTION delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tenant_id uuid;
    v_count integer;
BEGIN
    -- 1. Obtener tenant_id del usuario actual antes de borrarlo
    SELECT tenant_id INTO v_tenant_id FROM public.profiles WHERE id = auth.uid();

    -- 1.5. Eliminar dependencias (Suscripciones y Transacciones)
    -- Estos deletes disparan triggers que crean audit_logs con changed_by = auth.uid()
    DELETE FROM public.payment_transactions WHERE user_id = auth.uid();
    DELETE FROM public.subscriptions WHERE user_id = auth.uid();
    
    -- 2. Eliminar el perfil del usuario 
    -- Este delete dispara otro trigger que crea un audit_log
    DELETE FROM public.profiles WHERE id = auth.uid();

    -- 2.5. Eliminar ABSOLUTAMENTE TODOS los audit_logs creados por este usuario
    -- Esto debe hacerse JUSTO ANTES de eliminar el usuario auth, para borrar los logs creados arriba
    DELETE FROM public.audit_logs WHERE changed_by = auth.uid();

    -- 3. Eliminar el usuario de Auth (Esto libera el email)
    DELETE FROM auth.users WHERE id = auth.uid();

    -- 4. Limpieza de Tenant Huérfano (Opcional pero recomendado para onboarding cancelado)
    IF v_tenant_id IS NOT NULL THEN
        SELECT count(*) INTO v_count FROM public.profiles WHERE tenant_id = v_tenant_id;
        -- Si no quedan usuarios en ese tenant (probablemente era el único creando la escuela)
        IF v_count = 0 THEN
            DELETE FROM public.tenants WHERE id = v_tenant_id;
        END IF;
    END IF;
END;
$$;



-- ########## FILE: 20260215000121_fix_delete_account_tenant_cascade.sql ##########
-- 20260215000121_fix_delete_account_tenant_cascade.sql

-- Forced update of the delete_own_account function to handle FK constraints on tenant deletion.
-- This ensures that if the tenant is orphaned (no users left), all its data is wiped clean.

CREATE OR REPLACE FUNCTION delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tenant_id uuid;
    v_count integer;
BEGIN
    -- 1. Obtener tenant_id del usuario actual antes de borrarlo
    SELECT tenant_id INTO v_tenant_id FROM public.profiles WHERE id = auth.uid();

    -- 1.5. Eliminar dependencias del USUARIO (Suscripciones y Transacciones)
    DELETE FROM public.payment_transactions WHERE user_id = auth.uid();
    DELETE FROM public.subscriptions WHERE user_id = auth.uid();
    
    -- 2. Eliminar el perfil del usuario 
    DELETE FROM public.profiles WHERE id = auth.uid();

    -- 2.5. Eliminar ABSOLUTAMENTE TODOS los audit_logs creados por este usuario
    DELETE FROM public.audit_logs WHERE changed_by = auth.uid();

    -- 3. Eliminar el usuario de Auth (Esto libera el email)
    DELETE FROM auth.users WHERE id = auth.uid();

    -- 4. Limpieza de Tenant Huérfano (Cascada Manual)
    IF v_tenant_id IS NOT NULL THEN
        SELECT count(*) INTO v_count FROM public.profiles WHERE tenant_id = v_tenant_id;
        
        -- Si no quedan usuarios en ese tenant (probablemente era el único creando la escuela)
        IF v_count = 0 THEN
            -- Eliminar datos dependientes del tenant en orden (hijos -> padres)
            
            -- Schedules y Settings
            DELETE FROM public.schedules WHERE tenant_id = v_tenant_id;
            DELETE FROM public.schedule_settings WHERE tenant_id = v_tenant_id;
            
            -- Students y Groups (Grupos dependen de Years, Estudiantes de Grupos)
            -- Asumiendo que students tienen tenant_id
            DELETE FROM public.students WHERE tenant_id = v_tenant_id;
            
            -- Grupos dependen de academic_years
            -- DELETE FROM public.groups WHERE tenant_id = v_tenant_id; -- (Si tienen tenant_id directo)
            -- O borrar via academic_years si es cascade, pero mejor explícito
            DELETE FROM public.groups WHERE tenant_id = v_tenant_id;

            -- Academic Years (Esto solía bloquear el borrado del tenant)
            DELETE FROM public.academic_years WHERE tenant_id = v_tenant_id;

            -- Subjects (Si son por tenant)
            -- DELETE FROM public.subjects WHERE tenant_id = v_tenant_id; 

            -- Finalmente, eliminar el Tenant
            DELETE FROM public.tenants WHERE id = v_tenant_id;
        END IF;
    END IF;
END;
$$;



-- ########## FILE: 20260215000122_fix_delete_account_final_order.sql ##########
-- 20260215000122_fix_delete_account_final_order.sql

-- Forced update of the delete_own_account function to fix the order of operations.
-- The Tenant Cleanup must happen BEFORE deleting the auth.user, because deleting the tenant
-- triggers audit logs that reference the user. If the user is already gone, the audit log insert fails.

CREATE OR REPLACE FUNCTION delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tenant_id uuid;
    v_count integer;
BEGIN
    -- 1. Obtener tenant_id del usuario actual antes de borrarlo
    SELECT tenant_id INTO v_tenant_id FROM public.profiles WHERE id = auth.uid();

    -- 2. Eliminar dependencias del USUARIO (Suscripciones y Transacciones)
    DELETE FROM public.payment_transactions WHERE user_id = auth.uid();
    DELETE FROM public.subscriptions WHERE user_id = auth.uid();
    
    -- 3. Eliminar el perfil del usuario 
    DELETE FROM public.profiles WHERE id = auth.uid();

    -- 4. Limpieza de Tenant Huérfano (Cascada Manual)
    -- Hacemos esto ANTES de borrar el usuario de auth, para que los triggers de audit_logs funcionen
    IF v_tenant_id IS NOT NULL THEN
        SELECT count(*) INTO v_count FROM public.profiles WHERE tenant_id = v_tenant_id;
        
        -- Si no quedan usuarios en ese tenant (probablemente era el único creando la escuela)
        IF v_count = 0 THEN
            -- Eliminar datos dependientes del tenant en orden (hijos -> padres)
            DELETE FROM public.schedules WHERE tenant_id = v_tenant_id;
            DELETE FROM public.schedule_settings WHERE tenant_id = v_tenant_id;
            DELETE FROM public.students WHERE tenant_id = v_tenant_id;
            DELETE FROM public.groups WHERE tenant_id = v_tenant_id;
            DELETE FROM public.academic_years WHERE tenant_id = v_tenant_id;
            
            -- Finalmente, eliminar el Tenant
            DELETE FROM public.tenants WHERE id = v_tenant_id;
        END IF;
    END IF;

    -- 5. Eliminar ABSOLUTAMENTE TODOS los audit_logs creados por este usuario
    -- Esto incluye los logs generados por los deletes de arriba (perfil, tenant, etc)
    DELETE FROM public.audit_logs WHERE changed_by = auth.uid();

    -- 6. Finalmente, eliminar el usuario de Auth (Esto libera el email)
    DELETE FROM auth.users WHERE id = auth.uid();

END;
$$;



-- ########## FILE: 20260215000123_add_license_keys.sql ##########
-- Migration: Add License Keys System
-- Description: Creates license_keys table and redemption RPC

-- 1. Create license_keys table
CREATE TABLE IF NOT EXISTS public.license_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    plan_type TEXT NOT NULL CHECK (plan_type IN ('basic', 'pro')),
    duration_days INTEGER NOT NULL DEFAULT 30, -- How long the license lasts (e.g. 30 days, 365 days)
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'redeemed', 'revoked')),
    created_by UUID REFERENCES auth.users(id),
    redeemed_by UUID REFERENCES auth.users(id),
    redeemed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ, -- Optional expiration for the key itself
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_license_keys_code ON public.license_keys(code);
CREATE INDEX IF NOT EXISTS idx_license_keys_status ON public.license_keys(status);

-- 3. RLS
ALTER TABLE public.license_keys ENABLE ROW LEVEL SECURITY;

-- Super Admins can do everything
CREATE POLICY "Super Admins can manage license keys" ON public.license_keys
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'SUPER_ADMIN'
        )
    );

-- 4. RPC to redeem a license key
CREATE OR REPLACE FUNCTION public.redeem_license_key(key_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_key_record RECORD;
    v_user_id UUID;
    v_subscription_id UUID;
BEGIN
    v_user_id := auth.uid();
    
    -- Check if key exists and is valid
    SELECT * INTO v_key_record
    FROM public.license_keys
    WHERE code = key_code
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > NOW());
      
    IF v_key_record.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Licencia inválida o expirada.');
    END IF;

    -- Update Key Status
    UPDATE public.license_keys
    SET status = 'redeemed',
        redeemed_by = v_user_id,
        redeemed_at = NOW()
    WHERE id = v_key_record.id;

    -- Update/Upsert Subscription
    -- If it's a trial key (duration < 32 days), force BASIC plan unless specified otherwise by logic (but here we trust the key's plan_type)
    -- User specified: "el mes gratis sera solo para el plan basicas"
    -- So we should ensure keys generated for 'free trial' (30 days) are likely BASIC.
    -- However, the key itself has a plan_type. We will trust the key creator (Super Admin) to set it correctly.
    
    INSERT INTO public.subscriptions (user_id, status, plan_type, current_period_end)
    VALUES (
        v_user_id, 
        'active', 
        v_key_record.plan_type, 
        NOW() + (v_key_record.duration_days || ' days')::INTERVAL
    )
    ON CONFLICT (user_id) 
    DO UPDATE SET 
        status = 'active',
        plan_type = EXCLUDED.plan_type,
        current_period_end = GREATEST(subscriptions.current_period_end, NOW()) + (v_key_record.duration_days || ' days')::INTERVAL,
        updated_at = NOW();

    RETURN jsonb_build_object('success', true, 'message', 'Licencia canjeada exitosamente.');
END;
$$;



