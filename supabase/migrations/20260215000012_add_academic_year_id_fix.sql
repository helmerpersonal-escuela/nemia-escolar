-- FIX: Add academic_year_id if missing to analytical_programs

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytical_programs' AND column_name = 'academic_year_id') THEN
        ALTER TABLE public.analytical_programs 
        ADD COLUMN academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE CASCADE;
        
        -- Create index if logically consistent
        CREATE INDEX IF NOT EXISTS idx_analytical_academic_year ON public.analytical_programs(academic_year_id);
    END IF;
END $$;
