-- Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.student_incidents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
    teacher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('CONDUCTA', 'ACADEMICO', 'EMOCIONAL', 'POSITIVO', 'SALUD')),
    severity TEXT NOT NULL CHECK (severity IN ('BAJA', 'MEDIA', 'ALTA')),
    description TEXT NOT NULL,
    action_taken TEXT,
    is_private BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add new columns if they don't exist
ALTER TABLE public.student_incidents 
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'RESOLVED', 'SIGNED')),
ADD COLUMN IF NOT EXISTS has_commitment BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS commitment_description TEXT;

-- Update existing records to have a title if missing
UPDATE public.student_incidents SET title = 'Reporte General' WHERE title IS NULL;

-- Make title required
ALTER TABLE public.student_incidents ALTER COLUMN title SET NOT NULL;

-- Enable RLS
ALTER TABLE public.student_incidents ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'student_incidents' AND policyname = 'Users can view incidents for their tenant'
    ) THEN
        CREATE POLICY "Users can view incidents for their tenant"
        ON public.student_incidents FOR SELECT
        USING (auth.uid() IN (SELECT id FROM public.profiles WHERE tenant_id = student_incidents.tenant_id));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'student_incidents' AND policyname = 'Users can log incidents'
    ) THEN
        CREATE POLICY "Users can log incidents"
        ON public.student_incidents FOR INSERT
        WITH CHECK (auth.role() = 'authenticated');
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'student_incidents' AND policyname = 'Users can update incidents'
    ) THEN
        CREATE POLICY "Users can update incidents"
        ON public.student_incidents FOR UPDATE
        USING (auth.uid() IN (SELECT id FROM public.profiles WHERE tenant_id = student_incidents.tenant_id));
    END IF;
END $$;
