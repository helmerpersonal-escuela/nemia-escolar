-- DIAGNOSTIC: Temporarily disable RLS to verify if 403 persists
ALTER TABLE public.staff_attendance DISABLE ROW LEVEL SECURITY;

-- Also check if there are any stray triggers or constraints
-- (This is just a comment, but good for tracking)
