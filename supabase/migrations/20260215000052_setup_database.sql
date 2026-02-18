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
