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
