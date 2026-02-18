
-- AMPLIACIÓN DEL PROGRAMA ANALÍTICO PARA FORMATO NEM COMPLETO
-- Agregamos campos estructurados para Contexto, Diagnóstico y Estrategias

ALTER TABLE public.analytical_programs 
ADD COLUMN IF NOT EXISTS school_data JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS external_context JSONB DEFAULT '{"favors": "", "difficults": ""}',
ADD COLUMN IF NOT EXISTS internal_context JSONB DEFAULT '{"favors": "", "difficults": ""}',
ADD COLUMN IF NOT EXISTS group_diagnosis JSONB DEFAULT '{"narrative": "", "problem_situations": [], "interest_topics": []}',
ADD COLUMN IF NOT EXISTS pedagogical_strategies JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS evaluation_strategies JSONB DEFAULT '{"description": "", "instruments": [], "feedback_guidelines": []}',
ADD COLUMN IF NOT EXISTS national_strategies JSONB DEFAULT '[]';

COMMENT ON COLUMN public.analytical_programs.school_data IS 'Datos de la escuela: CCT, Nivel, Modalidad, Sostenimiento, etc.';
COMMENT ON COLUMN public.analytical_programs.external_context IS 'Análisis del contexto externo: lo que favorece y dificulta el aprendizaje.';
COMMENT ON COLUMN public.analytical_programs.internal_context IS 'Análisis del contexto interno: lo que favorece y dificulta el aprendizaje.';
COMMENT ON COLUMN public.analytical_programs.group_diagnosis IS 'Diagnóstico detallado del grupo, situaciones-problema y temas de interés.';
COMMENT ON COLUMN public.analytical_programs.pedagogical_strategies IS 'Lista de metodologías seleccionadas (ABP, STEAM, etc.)';
COMMENT ON COLUMN public.analytical_programs.evaluation_strategies IS 'Enfoque, instrumentos y pautas de retroalimentación.';
COMMENT ON COLUMN public.analytical_programs.national_strategies IS 'Lista de estrategias nacionales incorporadas (Lectura, Inclusión, etc.)';
