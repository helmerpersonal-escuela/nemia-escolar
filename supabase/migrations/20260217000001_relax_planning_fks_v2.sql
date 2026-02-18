
-- Relax the foreign key constraint on lesson_plans(subject_id)
-- This allows lesson plans to be associated with custom subjects (group_subjects.id) 
-- that are not in the global subject_catalog.

DO $$
BEGIN
    -- Check if the constraint exists before trying to drop it
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE table_name = 'lesson_plans' 
        AND constraint_name = 'lesson_plans_subject_id_fkey'
    ) THEN
        ALTER TABLE public.lesson_plans DROP CONSTRAINT lesson_plans_subject_id_fkey;
        
        -- Add it back without the reference to subject_catalog, 
        -- or just leave it as a UUID column if we want full flexibility.
        -- Given the architecture, we'll keep it as a UUID column without the FK to catalog.
        RAISE NOTICE 'Dropped lesson_plans_subject_id_fkey';
    END IF;
END $$;
