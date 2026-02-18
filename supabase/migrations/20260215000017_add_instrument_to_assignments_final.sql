-- Migration: Add instrument_id to assignments
-- This allows linking an interactive instrument (rubric/checklist) to a specific assignment.

ALTER TABLE public.assignments 
ADD COLUMN IF NOT EXISTS instrument_id UUID REFERENCES public.rubrics(id) ON DELETE SET NULL;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_assignments_instrument ON public.assignments(instrument_id);

-- Optional: Fix typo in weighting_percentage if it was created as weightING_percentage
-- (Postgres usually folds unquoted names to lowercase, but let's be safe)
-- DO NOT RENAME if it's already lowercased.
