-- CREACIÓN DE BUCKETS FALTANTES (MODO DIARIO)

-- 1. Bucket: student-evidence (Para portafolios y evidencias de alumnos)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('student-evidence', 'student-evidence', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Bucket: pemc_evidence (Para el Programa de Mejora Continua)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('pemc_evidence', 'pemc_evidence', false)
ON CONFLICT (id) DO NOTHING;

-- POLÍTICAS PARA student-evidence (Público para lectura, Autenticado para subida)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Access student-evidence') THEN
        CREATE POLICY "Public Access student-evidence" ON storage.objects FOR SELECT USING (bucket_id = 'student-evidence');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Auth Upload student-evidence') THEN
        CREATE POLICY "Auth Upload student-evidence" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'student-evidence');
    END IF;
END $$;

-- POLÍTICAS PARA pemc_evidence (Privado - Solo acceso por tenant_id vía folder path)
DO $$
BEGIN
    -- Simplificado para demo: Acceso para cualquier usuario autenticado en el bucket
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Auth Access pemc_evidence') THEN
        CREATE POLICY "Auth Access pemc_evidence" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'pemc_evidence');
    END IF;
END $$;
