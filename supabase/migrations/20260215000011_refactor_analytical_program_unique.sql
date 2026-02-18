-- MODIFICACIÓN: PROGRAMA ANALÍTICO ÚNICO POR ESCUELA
-- Se elimina la dependencia de grupo y materia en la tabla principal.
-- La materia se vincula ahora a nivel de contenido individual.

-- 1. Eliminar columnas innecesarias de la tabla principal
ALTER TABLE public.analytical_programs DROP COLUMN IF EXISTS group_id;
ALTER TABLE public.analytical_programs DROP COLUMN IF EXISTS subject_id;

-- 2. Modificar la tabla de contenidos para incluir subject_id
-- Esto permite que el programa sea único de la escuela, pero cada contenido sea de una materia diferente.
ALTER TABLE public.analytical_program_contents ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES public.subject_catalog(id) ON DELETE SET NULL;

-- 3. Actualizar comentario
COMMENT ON TABLE public.analytical_programs IS 'Programa Analítico ÚNICO por escuela y ciclo escolar. Basado en diagnóstico integral.';
