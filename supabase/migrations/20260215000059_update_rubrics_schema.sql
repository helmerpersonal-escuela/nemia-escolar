-- Add JSONB content column for flexible instrument structures
ALTER TABLE public.rubrics ADD COLUMN IF NOT EXISTS content JSONB DEFAULT '{}'::jsonb;

-- Add AI and Sharing flags
ALTER TABLE public.rubrics ADD COLUMN IF NOT EXISTS is_ai_generated BOOLEAN DEFAULT FALSE;
ALTER TABLE public.rubrics ADD COLUMN IF NOT EXISTS original_prompt TEXT;
ALTER TABLE public.rubrics ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE; -- For the "Global Bank" feature

-- Update Type Constraint to support all 10 instrument types
ALTER TABLE public.rubrics DROP CONSTRAINT IF EXISTS rubrics_type_check;
ALTER TABLE public.rubrics ADD CONSTRAINT rubrics_type_check CHECK (type IN (
    'ANALYTIC', 
    'HOLISTIC', 
    'CHECKLIST', 
    'QUIZ', 
    'OBSERVATION', 
    'JOURNAL', 
    'TEST', 
    'INTERVIEW', 
    'PORTFOLIO', 
    'MAP', 
    'SELF_ASSESSMENT'
));
