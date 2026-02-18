
-- Tabla Principal de Rúbricas
CREATE TABLE IF NOT EXISTS public.rubrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL CHECK (type IN ('ANALYTIC', 'HOLISTIC')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Niveles de Desempeño (Columnas: Ej. Excelente(4), Bueno(3)...)
CREATE TABLE IF NOT EXISTS public.rubric_levels (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    rubric_id UUID REFERENCES public.rubrics(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL, -- "Excelente", "Necesita Mejora"
    score NUMERIC(5,2) NOT NULL, -- 4.0, 10.0
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criterios de Evaluación (Filas: Ej. Ortografía, Coherencia...)
CREATE TABLE IF NOT EXISTS public.rubric_criteria (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    rubric_id UUID REFERENCES public.rubrics(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    weight NUMERIC(5,2) DEFAULT 0, -- Opcional, si se pondera
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Descriptores (Celdas: Descripción específica para Criterio X en Nivel Y)
CREATE TABLE IF NOT EXISTS public.rubric_descriptors (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    criterion_id UUID REFERENCES public.rubric_criteria(id) ON DELETE CASCADE NOT NULL,
    level_id UUID REFERENCES public.rubric_levels(id) ON DELETE CASCADE NOT NULL,
    description TEXT, -- "El alumno no comete errores ortográficos."
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(criterion_id, level_id)
);

-- Habilitar RLS
ALTER TABLE public.rubrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rubric_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rubric_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rubric_descriptors ENABLE ROW LEVEL SECURITY;

-- Políticas RLS (Standard Tenant Access)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'rubrics' AND policyname = 'Enable access for tenant users'
    ) THEN
        CREATE POLICY "Enable access for tenant users" ON public.rubrics
    USING (auth.uid() IN (SELECT id FROM profiles WHERE tenant_id = rubrics.tenant_id))
    WITH CHECK (auth.uid() IN (SELECT id FROM profiles WHERE tenant_id = rubrics.tenant_id));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'rubric_levels' AND policyname = 'Enable access for tenant users'
    ) THEN
        CREATE POLICY "Enable access for tenant users" ON public.rubric_levels
    USING (rubric_id IN (SELECT id FROM rubrics WHERE tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid())));
    END IF;
END $$;
    -- Access via parent rubric check for cleaner logic, or direct join (simplified here via subquery logic)

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'rubric_criteria' AND policyname = 'Enable access for tenant users'
    ) THEN
        CREATE POLICY "Enable access for tenant users" ON public.rubric_criteria
    USING (rubric_id IN (SELECT id FROM rubrics WHERE tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid())));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'rubric_descriptors' AND policyname = 'Enable access for tenant users'
    ) THEN
        CREATE POLICY "Enable access for tenant users" ON public.rubric_descriptors
    USING (criterion_id IN (SELECT id FROM rubric_criteria WHERE rubric_id IN (SELECT id FROM rubrics WHERE tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()))));
    END IF;
END $$;
