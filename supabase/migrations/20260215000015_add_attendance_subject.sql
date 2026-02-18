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
