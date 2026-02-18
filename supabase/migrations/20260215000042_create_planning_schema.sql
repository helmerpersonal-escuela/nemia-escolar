-- TABLA DE PLANEACIÓN DIDÁCTICA (NEM)
-- Removed DROP TABLE to prevent data loss on existing environments

CREATE TABLE IF NOT EXISTS public.lesson_plans (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
    subject_id UUID REFERENCES public.subject_catalog(id) ON DELETE SET NULL,
    period_id UUID REFERENCES public.evaluation_periods(id) ON DELETE SET NULL,
    
    title TEXT NOT NULL,
    temporality TEXT CHECK (temporality IN ('WEEKLY', 'MONTHLY', 'PROJECT')),
    start_date DATE,
    end_date DATE,
    
    -- Campos Core NEM
    campo_formativo TEXT,
    metodologia TEXT, -- ABP, STEAM, ABS, etc.
    problem_context TEXT, -- Identificación de la situación problemática
    
    -- Secciones Estructuradas (JSONB para flexibilidad)
    objectives JSONB DEFAULT '[]',
    contents JSONB DEFAULT '[]', -- Contenidos del programa sintético
    pda JSONB DEFAULT '[]', -- Procesos de Desarrollo de Aprendizaje
    ejes_articuladores JSONB DEFAULT '[]', -- Inclusión, Pensamiento Crítico, etc.
    
    -- Secuencia Didáctica
    activities_sequence JSONB DEFAULT '[]', -- Pasos, sesiones y actividades
    
    -- Recursos y Evaluación
    resources TEXT[],
    evaluation_plan JSONB DEFAULT '{}', -- Instrumentos y criterios
    
    status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SUBMITTED', 'APPROVED')),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Idempotent Column Addition
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_plans' AND column_name = 'period_id') THEN
        ALTER TABLE public.lesson_plans ADD COLUMN period_id UUID REFERENCES public.evaluation_periods(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_plans' AND column_name = 'temporality') THEN
        ALTER TABLE public.lesson_plans ADD COLUMN temporality TEXT CHECK (temporality IN ('WEEKLY', 'MONTHLY', 'PROJECT'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_plans' AND column_name = 'start_date') THEN
        ALTER TABLE public.lesson_plans ADD COLUMN start_date DATE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_plans' AND column_name = 'end_date') THEN
        ALTER TABLE public.lesson_plans ADD COLUMN end_date DATE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_plans' AND column_name = 'metodologia') THEN
        ALTER TABLE public.lesson_plans ADD COLUMN metodologia TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_plans' AND column_name = 'problem_context') THEN
        ALTER TABLE public.lesson_plans ADD COLUMN problem_context TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_plans' AND column_name = 'status') THEN
        ALTER TABLE public.lesson_plans ADD COLUMN status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SUBMITTED', 'APPROVED'));
    END IF;
    
    -- Add other columns if potentially missing from older versions
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_plans' AND column_name = 'objectives') THEN
        ALTER TABLE public.lesson_plans ADD COLUMN objectives JSONB DEFAULT '[]';
    END IF;
END $$;

-- Habilitar RLS
ALTER TABLE public.lesson_plans ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'lesson_plans' AND policyname = 'Enable access for tenant users on lesson_plans'
    ) THEN
        CREATE POLICY "Enable access for tenant users on lesson_plans" ON public.lesson_plans
    USING (auth.uid() IN (SELECT id FROM profiles WHERE tenant_id = lesson_plans.tenant_id))
    WITH CHECK (auth.uid() IN (SELECT id FROM profiles WHERE tenant_id = lesson_plans.tenant_id));
    END IF;
END $$;

-- Índice para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_plans_group ON public.lesson_plans(group_id);
CREATE INDEX IF NOT EXISTS idx_plans_period ON public.lesson_plans(period_id);
