-- Fix for analytical_programs status constraint with DATA SANITIZATION
-- We broaden the allowed values to include both English and Spanish terms.

DO $$
BEGIN
    -- 1. Sanitize existing data: invalid statuses become 'DRAFT'
    UPDATE public.analytical_programs 
    SET status = 'DRAFT' 
    WHERE status NOT IN ('DRAFT', 'COMPLETED', 'FINALIZADO');

    -- 2. Drop old constraint if exists
    ALTER TABLE public.analytical_programs DROP CONSTRAINT IF EXISTS analytical_programs_status_check;
    
    -- 3. Add new lenient constraint
    ALTER TABLE public.analytical_programs 
    ADD CONSTRAINT analytical_programs_status_check 
    CHECK (status IN ('DRAFT', 'COMPLETED', 'FINALIZADO'));
END $$;
