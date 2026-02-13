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
