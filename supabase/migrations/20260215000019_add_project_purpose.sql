
-- Agregar columna 'purpose' a la tabla lesson_plans si no existe
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_plans' AND column_name = 'purpose') THEN
        ALTER TABLE public.lesson_plans ADD COLUMN purpose TEXT;
    END IF;
END $$;
