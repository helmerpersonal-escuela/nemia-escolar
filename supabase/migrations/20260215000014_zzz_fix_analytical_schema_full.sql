-- FIX: Comprehensive Schema Repair for analytical_programs
-- Ensures all required columns and policies exist.

DO $$ 
BEGIN 
    -- 1. Ensure tenant_id exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytical_programs' AND column_name = 'tenant_id') THEN
        ALTER TABLE public.analytical_programs ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
    END IF;

    -- 2. Ensure academic_year_id exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytical_programs' AND column_name = 'academic_year_id') THEN
        ALTER TABLE public.analytical_programs ADD COLUMN academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_analytical_academic_year ON public.analytical_programs(academic_year_id);
    END IF;

    -- 3. Ensure status exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytical_programs' AND column_name = 'status') THEN
        ALTER TABLE public.analytical_programs ADD COLUMN status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'COMPLETED'));
    END IF;

    -- 4. Ensure timestamps exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytical_programs' AND column_name = 'created_at') THEN
        ALTER TABLE public.analytical_programs ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytical_programs' AND column_name = 'updated_at') THEN
        ALTER TABLE public.analytical_programs ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- 5. Enable RLS
ALTER TABLE public.analytical_programs ENABLE ROW LEVEL SECURITY;

-- 6. Refresh Policies (Safe idempotent check)
DO $$
BEGIN
    -- We can try to drop if really needed or just check if exists.
    -- The previous script tried to drop. Let's stick to "IF NOT EXISTS CREATE".
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'analytical_programs' AND policyname = 'Enable access for tenant users on analytical_programs'
    ) THEN
        CREATE POLICY "Enable access for tenant users on analytical_programs" ON public.analytical_programs
        USING (auth.uid() IN (SELECT id FROM profiles WHERE tenant_id = analytical_programs.tenant_id))
        WITH CHECK (auth.uid() IN (SELECT id FROM profiles WHERE tenant_id = analytical_programs.tenant_id));
    END IF;
END $$;
