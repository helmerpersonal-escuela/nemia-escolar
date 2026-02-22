-- Crear tabla para los libros/recursos subidos por el propio usuario
CREATE TABLE IF NOT EXISTS public.user_textbooks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    file_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.user_textbooks ENABLE ROW LEVEL SECURITY;

-- Políticas
-- Un usuario solo puede ver sus propios libros
CREATE POLICY "Users can view their own textbooks"
ON public.user_textbooks FOR SELECT
TO authenticated
USING (profile_id = auth.uid());

-- Un usuario solo puede insertar libros bajo su propio ID
CREATE POLICY "Users can insert their own textbooks"
ON public.user_textbooks FOR INSERT
TO authenticated
WITH CHECK (profile_id = auth.uid());

-- Un usuario solo puede borrar sus propios libros
CREATE POLICY "Users can delete their own textbooks"
ON public.user_textbooks FOR DELETE
TO authenticated
USING (profile_id = auth.uid());

-- Índices para mejorar velocidad de consulta por usuario
CREATE INDEX IF NOT EXISTS idx_user_textbooks_profile ON public.user_textbooks(profile_id);
