-- TABLA DE LIBROS DE TEXTO (REPOSITORIO)
CREATE TABLE IF NOT EXISTS public.textbooks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    level TEXT NOT NULL CHECK (level IN ('PRIMARIA', 'SECUNDARIA', 'TELESECUNDARIA')),
    grade INTEGER NOT NULL,
    field_of_study TEXT,
    subject_id UUID REFERENCES public.subject_catalog(id) ON DELETE SET NULL,
    file_url TEXT NOT NULL,
    thumbnail_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- EXTENSIÓN DE PLANEACIÓN PARA VINCULAR LIBROS
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_plans' AND column_name = 'textbook_id') THEN
        ALTER TABLE public.lesson_plans ADD COLUMN textbook_id UUID REFERENCES public.textbooks(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_plans' AND column_name = 'textbook_pages_from') THEN
        ALTER TABLE public.lesson_plans ADD COLUMN textbook_pages_from INTEGER;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_plans' AND column_name = 'textbook_pages_to') THEN
        ALTER TABLE public.lesson_plans ADD COLUMN textbook_pages_to INTEGER;
    END IF;
END $$;

-- HABILITAR RLS
ALTER TABLE public.textbooks ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS RLS PARA TEXTBOOKS
-- Lectura permitida para cualquier usuario autenticado
CREATE POLICY "Allow authenticated users to read textbooks" 
ON public.textbooks FOR SELECT 
TO authenticated 
USING (true);

-- Gestión solo para SuperAdmins (profiles con rol 'ADMIN' o similar, pero validado por tenant o email específico si es global)
-- Dado que es "Modo Dios", usualmente el SuperAdmin tiene acceso a todo.
-- Sin embargo, el SuperAdmin Dashboard usa rpc o direct updates.
-- Por seguridad, permitiremos inserción si el usuario es el dueño del sistema (helmerpersonal@gmail.com)
CREATE POLICY "Allow superadmins to manage textbooks" 
ON public.textbooks FOR ALL 
TO authenticated 
USING (auth.jwt() ->> 'email' = 'helmerpersonal@gmail.com')
WITH CHECK (auth.jwt() ->> 'email' = 'helmerpersonal@gmail.com');

-- STORAGE BUCKET: textbooks
-- Nota: La creación de buckets vía SQL depende de si está habilitado el schema storage.
INSERT INTO storage.buckets (id, name, public) 
VALUES ('textbooks', 'textbooks', true)
ON CONFLICT (id) DO NOTHING;

-- POLÍTICAS DE STORAGE PARA TEXTBOOKS
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'textbooks');
CREATE POLICY "Admin Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'textbooks' AND auth.jwt() ->> 'email' = 'helmerpersonal@gmail.com');
CREATE POLICY "Admin Delete" ON storage.objects FOR DELETE USING (bucket_id = 'textbooks' AND auth.jwt() ->> 'email' = 'helmerpersonal@gmail.com');

-- ÍNDICES
CREATE INDEX IF NOT EXISTS idx_textbooks_level_grade ON public.textbooks(level, grade);
CREATE INDEX IF NOT EXISTS idx_textbooks_field ON public.textbooks(field_of_study);
