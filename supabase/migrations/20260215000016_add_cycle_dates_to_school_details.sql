ALTER TABLE public.school_details 
ADD COLUMN IF NOT EXISTS current_cycle_start date,
ADD COLUMN IF NOT EXISTS current_cycle_end date;
