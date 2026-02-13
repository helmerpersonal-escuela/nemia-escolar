-- TABLA DE INCIDENCIAS (BITÁCORA)
CREATE TABLE IF NOT EXISTS public.student_incidents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
    teacher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('CONDUCTA', 'ACADEMICO', 'EMOCIONAL', 'POSITIVO', 'SALUD')),
    severity TEXT NOT NULL CHECK (severity IN ('BAJA', 'MEDIA', 'ALTA')),
    description TEXT NOT NULL,
    action_taken TEXT,
    is_private BOOLEAN DEFAULT FALSE, -- Si solo el autor puede verlo
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TABLA DE BAP Y AJUSTES RAZONABLES (INCLUSIÓN)
CREATE TABLE IF NOT EXISTS public.student_bap_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
    barrier_type TEXT, -- Físicas, Curriculares, Sociales, etc.
    diagnosis TEXT,
    adjustments JSONB, -- Array de ajustes específicos
    follow_up_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(student_id) -- Un registro de seguimiento por alumno
);

-- RLS
ALTER TABLE public.student_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_bap_records ENABLE ROW LEVEL SECURITY;

-- Policity for Incidents
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'student_incidents' AND policyname = 'Users can view incidents for their tenant'
    ) THEN
        CREATE POLICY "Users can view incidents for their tenant" ON public.student_incidents FOR SELECT
USING (auth.uid() IN (SELECT id FROM public.profiles WHERE tenant_id = student_incidents.tenant_id));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'student_incidents' AND policyname = 'Users can log incidents'
    ) THEN
        CREATE POLICY "Users can log incidents" ON public.student_incidents FOR INSERT
WITH CHECK (auth.role() = 'authenticated');
    END IF;
END $$;

-- Policity for BAP
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'student_bap_records' AND policyname = 'Users can view BAP records'
    ) THEN
        CREATE POLICY "Users can view BAP records" ON public.student_bap_records FOR SELECT
USING (auth.uid() IN (SELECT id FROM public.profiles WHERE tenant_id = student_bap_records.tenant_id));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'student_bap_records' AND policyname = 'Teachers can manage BAP'
    ) THEN
        CREATE POLICY "Teachers can manage BAP" ON public.student_bap_records FOR ALL
USING (auth.uid() IN (SELECT id FROM public.profiles WHERE tenant_id = student_bap_records.tenant_id));
    END IF;
END $$;
