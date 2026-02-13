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
