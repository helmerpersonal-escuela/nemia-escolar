-- ADAPTACIÓN PARA DOCUMENTO VIVO (REVISIONES CTE)
-- Permite rastrear la última sesión de revisión sin bloquear el documento.

-- 1. Agregar campo para la última sesión de CTE
ALTER TABLE public.analytical_programs ADD COLUMN IF NOT EXISTS last_cte_session TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2. Eliminar restricción de status si existía o ajustarla
-- (En el esquema previo era CHECK (status IN ('DRAFT', 'COMPLETED')))
ALTER TABLE public.analytical_programs DROP CONSTRAINT IF EXISTS analytical_programs_status_check;
ALTER TABLE public.analytical_programs ADD CONSTRAINT analytical_programs_status_check CHECK (status IN ('ACTIVE', 'DRAFT'));

-- 3. Actualizar programas existentes a ACTIVE
UPDATE public.analytical_programs SET status = 'ACTIVE' WHERE status = 'COMPLETED';
