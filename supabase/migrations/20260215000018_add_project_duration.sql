-- Agregar columna 'project_duration' a la tabla lesson_plans para persistencia de duración de proyectos
ALTER TABLE public.lesson_plans 
ADD COLUMN IF NOT EXISTS project_duration INTEGER DEFAULT 10;

COMMENT ON COLUMN public.lesson_plans.project_duration IS 'Duración estimada del proyecto en número de sesiones.';
