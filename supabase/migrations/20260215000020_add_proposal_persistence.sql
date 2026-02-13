-- Migration to add program_by_fields column for AI proposal persistence
ALTER TABLE public.analytical_programs 
ADD COLUMN IF NOT EXISTS program_by_fields JSONB DEFAULT '{
    "lenguajes": [],
    "saberes": [],
    "etica": [],
    "humano": []
}';

COMMENT ON COLUMN public.analytical_programs.program_by_fields IS 'Propuesta didáctica generada por IA estructurada por campos formativos.';
