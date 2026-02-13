-- Migration: Create Synthetic Program Catalog Table
-- Description: Stores the contents and PDA for the New Mexican School Model (NEM 2022) phases 1-6.

CREATE TABLE IF NOT EXISTS public.synthetic_program_contents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phase INTEGER NOT NULL CHECK (phase BETWEEN 1 AND 6),
    educational_level TEXT NOT NULL, -- 'INICIAL', 'PREESCOLAR', 'PRIMARIA', 'SECUNDARIA'
    field_of_study TEXT NOT NULL, -- 'Lenguajes', 'Saberes y Pensamiento Científico', etc.
    subject_name TEXT, -- Optional, used in Phase 6 (e.g., 'Español', 'Matemáticas')
    content TEXT NOT NULL,
    pda TEXT, -- Optional Process of Development of Learning
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indices for faster lookup
CREATE INDEX IF NOT EXISTS idx_synthetic_phase ON public.synthetic_program_contents(phase);
CREATE INDEX IF NOT EXISTS idx_synthetic_field ON public.synthetic_program_contents(field_of_study);
CREATE INDEX IF NOT EXISTS idx_synthetic_level ON public.synthetic_program_contents(educational_level);

-- Enable RLS
ALTER TABLE public.synthetic_program_contents ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'synthetic_program_contents' 
        AND policyname = 'Everyone can read synthetic_program_contents'
    ) THEN
        CREATE POLICY "Everyone can read synthetic_program_contents"
            ON public.synthetic_program_contents FOR SELECT 
            USING (auth.role() = 'authenticated');
    END IF;
END $$;
