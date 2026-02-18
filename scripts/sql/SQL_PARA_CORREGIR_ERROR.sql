-- INSTRUCCIONES:
-- 1. Ve al Dashboard de tu proyecto Supabase.
-- 2. SQL Editor -> New Query.
-- 3. Copia, Pega y Ejecuta ("Run").

-- FIX DEFINITIVO: Ajuste de Tipos y eliminación de Dependencias Fantasma

DO $$ 
BEGIN 
    ----------------------------------------------------------------
    -- TABLA PRINCIPAL: analytical_programs
    ----------------------------------------------------------------
    
    CREATE TABLE IF NOT EXISTS public.analytical_programs (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytical_programs' AND column_name = 'tenant_id') THEN
        ALTER TABLE public.analytical_programs ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytical_programs' AND column_name = 'academic_year_id') THEN
        ALTER TABLE public.analytical_programs ADD COLUMN academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_analytical_academic_year ON public.analytical_programs(academic_year_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytical_programs' AND column_name = 'status') THEN
        ALTER TABLE public.analytical_programs ADD COLUMN status TEXT DEFAULT 'DRAFT';
    END IF;

    -- Campos JSONB y Texto (aseguramos todos)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytical_programs' AND column_name = 'school_data') THEN
        ALTER TABLE public.analytical_programs ADD COLUMN school_data JSONB DEFAULT '{}';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytical_programs' AND column_name = 'diagnosis_narrative') THEN
        ALTER TABLE public.analytical_programs ADD COLUMN diagnosis_narrative TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytical_programs' AND column_name = 'problem_statements') THEN
        ALTER TABLE public.analytical_programs ADD COLUMN problem_statements JSONB DEFAULT '[]';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytical_programs' AND column_name = 'external_context') THEN
        ALTER TABLE public.analytical_programs ADD COLUMN external_context JSONB DEFAULT '{"favors": "", "difficults": ""}';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytical_programs' AND column_name = 'internal_context') THEN
        ALTER TABLE public.analytical_programs ADD COLUMN internal_context JSONB DEFAULT '{"favors": "", "difficults": ""}';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytical_programs' AND column_name = 'group_diagnosis') THEN
        ALTER TABLE public.analytical_programs ADD COLUMN group_diagnosis JSONB DEFAULT '{"narrative": "", "problem_situations": [], "interest_topics": []}';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytical_programs' AND column_name = 'pedagogical_strategies') THEN
        ALTER TABLE public.analytical_programs ADD COLUMN pedagogical_strategies JSONB DEFAULT '[]';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytical_programs' AND column_name = 'evaluation_strategies') THEN
        ALTER TABLE public.analytical_programs ADD COLUMN evaluation_strategies JSONB DEFAULT '{"description": "", "instruments": [], "feedback_guidelines": []}';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytical_programs' AND column_name = 'national_strategies') THEN
        ALTER TABLE public.analytical_programs ADD COLUMN national_strategies JSONB DEFAULT '[]';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytical_programs' AND column_name = 'last_cte_session') THEN
        ALTER TABLE public.analytical_programs ADD COLUMN last_cte_session TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytical_programs' AND column_name = 'updated_at') THEN
        ALTER TABLE public.analytical_programs ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;

    ----------------------------------------------------------------
    -- TABLA DETALLE: analytical_program_contents
    ----------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS public.analytical_program_contents (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        program_id UUID NOT NULL,
        campo_formativo TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytical_program_contents' AND column_name = 'program_id') THEN
        ALTER TABLE public.analytical_program_contents ADD COLUMN program_id UUID REFERENCES public.analytical_programs(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytical_program_contents' AND column_name = 'subject_id') THEN
        ALTER TABLE public.analytical_program_contents ADD COLUMN subject_id UUID REFERENCES public.subject_catalog(id) ON DELETE SET NULL;
    END IF;

    -- FIX: content_id como TEXT porque usamos IDs 'l1', 's1', etc. y NO existe tabla subject_contents en DB
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytical_program_contents' AND column_name = 'content_id') THEN
        ALTER TABLE public.analytical_program_contents ADD COLUMN content_id TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytical_program_contents' AND column_name = 'custom_content') THEN
        ALTER TABLE public.analytical_program_contents ADD COLUMN custom_content TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytical_program_contents' AND column_name = 'temporality') THEN
        ALTER TABLE public.analytical_program_contents ADD COLUMN temporality TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytical_program_contents' AND column_name = 'pda_ids') THEN
        -- PDAs son strings en el frontend, así que text[] es más seguro que UUID[] si no hay tabla
        ALTER TABLE public.analytical_program_contents ADD COLUMN pda_ids TEXT[] DEFAULT '{}';
    END IF;
    
     -- Corrección de tipo si existiera mal
    ALTER TABLE public.analytical_program_contents ALTER COLUMN pda_ids TYPE TEXT[] USING pda_ids::TEXT[];


    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytical_program_contents' AND column_name = 'justification') THEN
        ALTER TABLE public.analytical_program_contents ADD COLUMN justification TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytical_program_contents' AND column_name = 'ejes_articuladores') THEN
        ALTER TABLE public.analytical_program_contents ADD COLUMN ejes_articuladores TEXT[] DEFAULT '{}';
    END IF;

    ----------------------------------------------------------------
    -- SEGURIDAD (RLS)
    ----------------------------------------------------------------
    ALTER TABLE public.analytical_programs ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.analytical_program_contents ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Enable access for tenant users on analytical_programs" ON public.analytical_programs;
    
    CREATE POLICY "Enable access for tenant users on analytical_programs" ON public.analytical_programs
        USING (auth.uid() IN (SELECT id FROM profiles WHERE tenant_id = analytical_programs.tenant_id))
        WITH CHECK (auth.uid() IN (SELECT id FROM profiles WHERE tenant_id = analytical_programs.tenant_id));

    DROP POLICY IF EXISTS "Enable access for tenant users on contents" ON public.analytical_program_contents;

    CREATE POLICY "Enable access for tenant users on contents" ON public.analytical_program_contents
        USING (true) WITH CHECK (true);

END $$;
