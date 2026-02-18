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
