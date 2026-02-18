-- Add criterion_id to link assignments to evaluation_criteria
ALTER TABLE public.assignments 
ADD COLUMN IF NOT EXISTS criterion_id UUID REFERENCES public.evaluation_criteria(id) ON DELETE SET NULL;

-- Add lesson_plan_id to link activities to planning
ALTER TABLE public.assignments 
ADD COLUMN IF NOT EXISTS lesson_plan_id UUID REFERENCES public.lesson_plans(id) ON DELETE SET NULL;

-- Add start_date for projects
ALTER TABLE public.assignments 
ADD COLUMN IF NOT EXISTS start_date DATE;

-- Indices for faster lookups
CREATE INDEX IF NOT EXISTS idx_assignments_criterion ON public.assignments(criterion_id);
CREATE INDEX IF NOT EXISTS idx_assignments_lesson_plan ON public.assignments(lesson_plan_id);
