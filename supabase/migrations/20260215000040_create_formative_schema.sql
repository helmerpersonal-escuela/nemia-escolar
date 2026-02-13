
-- Tabla para Registros de Evaluación Formativa (Anecdóticos, Diarios, etc.)
CREATE TABLE IF NOT EXISTS public.formative_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE, -- Opcional (puede ser registro grupal)
    
    type TEXT NOT NULL CHECK (type IN ('ANECDOTAL', 'JOURNAL', 'OBSERVATION', 'CHECKLIST')),
    content JSONB NOT NULL, -- Almacena los campos específicos de cada instrumento
    observation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla para el Portafolio de Evidencias (Metadatos de Archivos)
CREATE TABLE IF NOT EXISTS public.evidence_portfolio (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
    assignment_id UUID REFERENCES public.assignments(id) ON DELETE SET NULL, -- Opcional: vinculado a una tarea
    
    title TEXT NOT NULL,
    description TEXT,
    file_url TEXT NOT NULL, -- URL de Supabase Storage
    file_type TEXT, -- "image", "audio", "document"
    
    period_id UUID REFERENCES public.evaluation_periods(id) ON DELETE SET NULL, -- Para organizar por trimestre
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.formative_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_portfolio ENABLE ROW LEVEL SECURITY;

-- Políticas RLS (Standard Tenant Access)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'formative_records' AND policyname = 'Enable access for tenant users on formative'
    ) THEN
        CREATE POLICY "Enable access for tenant users on formative" ON public.formative_records
    USING (auth.uid() IN (SELECT id FROM profiles WHERE tenant_id = formative_records.tenant_id))
    WITH CHECK (auth.uid() IN (SELECT id FROM profiles WHERE tenant_id = formative_records.tenant_id));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'evidence_portfolio' AND policyname = 'Enable access for tenant users on portfolio'
    ) THEN
        CREATE POLICY "Enable access for tenant users on portfolio" ON public.evidence_portfolio
    USING (auth.uid() IN (SELECT id FROM profiles WHERE tenant_id = evidence_portfolio.tenant_id))
    WITH CHECK (auth.uid() IN (SELECT id FROM profiles WHERE tenant_id = evidence_portfolio.tenant_id));
    END IF;
END $$;

-- Índices
CREATE INDEX IF NOT EXISTS idx_formative_student ON public.formative_records(student_id);
CREATE INDEX IF NOT EXISTS idx_formative_group ON public.formative_records(group_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_student ON public.evidence_portfolio(student_id);
