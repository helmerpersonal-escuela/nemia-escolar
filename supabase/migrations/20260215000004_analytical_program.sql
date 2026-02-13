-- MÓDULO DE PROGRAMA ANALÍTICO (NEM)
-- Este módulo es el segundo nivel de concreción, previo a la planeación didáctica.

CREATE TABLE IF NOT EXISTS public.analytical_programs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE CASCADE NOT NULL,
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
    subject_id UUID REFERENCES public.subject_catalog(id) ON DELETE SET NULL,
    
    -- Lectura de la realidad (Diagnóstico Socioeducativo)
    diagnosis_context TEXT, -- Narrativa general redactada (con ayuda de IA)
    
    -- Problemáticas de la comunidad/aula
    problem_statements JSONB DEFAULT '[]', -- [{id, description, priority}]
    
    status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'COMPLETED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure columns exist even if table was created previously (Idempotent schema evolution)
DO $$
BEGIN
    -- group_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytical_programs' AND column_name = 'group_id') THEN
        ALTER TABLE public.analytical_programs ADD COLUMN group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE;
    END IF;

    -- subject_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytical_programs' AND column_name = 'subject_id') THEN
        ALTER TABLE public.analytical_programs ADD COLUMN subject_id UUID REFERENCES public.subject_catalog(id) ON DELETE SET NULL;
    END IF;

    -- diagnosis_context
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytical_programs' AND column_name = 'diagnosis_context') THEN
        ALTER TABLE public.analytical_programs ADD COLUMN diagnosis_context TEXT;
    END IF;

    -- problem_statements
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytical_programs' AND column_name = 'problem_statements') THEN
        ALTER TABLE public.analytical_programs ADD COLUMN problem_statements JSONB DEFAULT '[]';
    END IF;

    -- status
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytical_programs' AND column_name = 'status') THEN
        ALTER TABLE public.analytical_programs ADD COLUMN status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'COMPLETED'));
    END IF;
END $$;

-- Contenidos y PDA vinculados al Programa Analítico (Codiseño y Contextualización)
CREATE TABLE IF NOT EXISTS public.analytical_program_contents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    program_id UUID REFERENCES public.analytical_programs(id) ON DELETE CASCADE NOT NULL,
    
    campo_formativo TEXT NOT NULL,
    content_id UUID REFERENCES public.subject_contents(id) ON DELETE SET NULL, -- Contenido del Programa Sintético
    custom_content TEXT, -- Para Codiseño (contenidos nuevos locales)
    
    pda_ids UUID[] DEFAULT '{}', -- Procesos de Desarrollo seleccionados
    justification TEXT, -- Por qué este contenido es relevante para la problemática
    temporality TEXT, -- Meses o Periodo sugerido
    ejes_articuladores TEXT[] DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.analytical_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytical_program_contents ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'analytical_programs' AND policyname = 'Enable access for tenant users on analytical_programs'
    ) THEN
        CREATE POLICY "Enable access for tenant users on analytical_programs" ON public.analytical_programs
    USING (auth.uid() IN (SELECT id FROM profiles WHERE tenant_id = analytical_programs.tenant_id))
    WITH CHECK (auth.uid() IN (SELECT id FROM profiles WHERE tenant_id = analytical_programs.tenant_id));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'analytical_program_contents' AND policyname = 'Enable access for tenant users on analytical_program_contents'
    ) THEN
        CREATE POLICY "Enable access for tenant users on analytical_program_contents" ON public.analytical_program_contents
    USING (EXISTS (
        SELECT 1 FROM analytical_programs p 
        WHERE p.id = analytical_program_contents.program_id 
        AND auth.uid() IN (SELECT id FROM profiles WHERE tenant_id = p.tenant_id)
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM analytical_programs p 
        WHERE p.id = analytical_program_contents.program_id 
        AND auth.uid() IN (SELECT id FROM profiles WHERE tenant_id = p.tenant_id)
    ));
    END IF;
END $$;

-- Índices
CREATE INDEX IF NOT EXISTS idx_analytical_group ON public.analytical_programs(group_id);
CREATE INDEX IF NOT EXISTS idx_analytical_subject ON public.analytical_programs(subject_id);
CREATE INDEX IF NOT EXISTS idx_analytical_contents_program ON public.analytical_program_contents(program_id);
