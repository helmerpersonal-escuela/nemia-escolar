-- Fix for analytical_programs status constraint
-- We broaden the allowed values to include both English and Spanish terms to be safe.

ALTER TABLE public.analytical_programs DROP CONSTRAINT IF EXISTS analytical_programs_status_check;

ALTER TABLE public.analytical_programs 
ADD CONSTRAINT analytical_programs_status_check 
CHECK (status IN ('DRAFT', 'COMPLETED', 'FINALIZADO'));

COMMENT ON COLUMN public.analytical_programs.status IS 'Estado del programa: DRAFT, COMPLETED, FINALIZADO';
