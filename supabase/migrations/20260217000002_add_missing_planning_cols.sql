-- Add missing columns to lesson_plans table
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_plans' AND column_name = 'project_duration') THEN
        ALTER TABLE public.lesson_plans ADD COLUMN project_duration INTEGER;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_plans' AND column_name = 'purpose') THEN
        ALTER TABLE public.lesson_plans ADD COLUMN purpose TEXT;
    END IF;
END $$;
