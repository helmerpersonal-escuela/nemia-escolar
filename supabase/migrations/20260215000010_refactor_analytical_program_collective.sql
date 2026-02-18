-- MODIFICACIÓN: PROGRAMA ANALÍTICO COLECTIVO
-- El programa analítico se elabora por escuela/asignatura, no por grupo individual.

-- 1. Eliminar la columna group_id de analytical_programs
ALTER TABLE public.analytical_programs DROP COLUMN IF EXISTS group_id;

-- 2. Asegurar que las políticas de RLS sigan funcionando a nivel tenant_id (escuela)
-- (Las políticas ya están basadas en tenant_id, así que deberían estar bien)

-- 3. Agregar comentario aclaratorio
COMMENT ON TABLE public.analytical_programs IS 'Programa Analítico elaborado colectivamente a nivel escuela por asignatura.';
