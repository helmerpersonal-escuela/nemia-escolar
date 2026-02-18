
-- Tabla de Periodos de Evaluación (ej. Trimestre 1, Unidad 2)
CREATE TABLE IF NOT EXISTS public.evaluation_periods (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL, -- "Primer Trimestre", "Parcial 1"
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT FALSE, -- Para marcar el periodo actual por defecto
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de Criterios de Evaluación por Grupo y Periodo
CREATE TABLE IF NOT EXISTS public.evaluation_criteria (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    period_id UUID REFERENCES public.evaluation_periods(id) ON DELETE CASCADE NOT NULL,
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
    
    name TEXT NOT NULL, -- "Examen", "Tareas", "Participación"
    percentage NUMERIC(5,2) NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
    description TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indices para busquedas rapidas
CREATE INDEX IF NOT EXISTS idx_eval_periods_tenant ON public.evaluation_periods(tenant_id);
CREATE INDEX IF NOT EXISTS idx_eval_criteria_group_period ON public.evaluation_criteria(group_id, period_id);

-- Habilitar RLS
ALTER TABLE public.evaluation_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_criteria ENABLE ROW LEVEL SECURITY;

-- Politicas RLS (Simplificadas: lectura/escritura para usuarios autenticados del mismo tenant)
-- PERIODS
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'evaluation_periods' AND policyname = 'Enable access for tenant users'
    ) THEN
        CREATE POLICY "Enable access for tenant users" ON public.evaluation_periods
    USING (auth.uid() IN (SELECT id FROM profiles WHERE tenant_id = evaluation_periods.tenant_id))
    WITH CHECK (auth.uid() IN (SELECT id FROM profiles WHERE tenant_id = evaluation_periods.tenant_id));
    END IF;
END $$;

-- CRITERIA
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'evaluation_criteria' AND policyname = 'Enable access for tenant users'
    ) THEN
        CREATE POLICY "Enable access for tenant users" ON public.evaluation_criteria
    USING (auth.uid() IN (SELECT id FROM profiles WHERE tenant_id = evaluation_criteria.tenant_id))
    WITH CHECK (auth.uid() IN (SELECT id FROM profiles WHERE tenant_id = evaluation_criteria.tenant_id));
    END IF;
END $$;
