-- Migración para insertar materias oficiales de Secundaria
INSERT INTO public.subject_catalog (name, educational_level)
VALUES 
    ('TECNOLOGÍA', 'SECONDARY'),
    ('ESPAÑOL', 'SECONDARY'),
    ('INGLES', 'SECONDARY'),
    ('TUTORÍA', 'SECONDARY'),
    ('MATEMÁTICAS', 'SECONDARY'),
    ('BIOLOGÍA', 'SECONDARY'),
    ('FÍSICA', 'SECONDARY'),
    ('QUÍMICA', 'SECONDARY'),
    ('HISTORIA', 'SECONDARY'),
    ('FORMACIÓN CÍVICA Y ÉTICA', 'SECONDARY'),
    ('AUTONOMÍA CURRICULAR', 'SECONDARY'),
    ('GEOGRAFÍA', 'SECONDARY'),
    ('EDUCACIÓN FÍSICA', 'SECONDARY'),
    ('ARTES', 'SECONDARY')
ON CONFLICT (name, educational_level) DO NOTHING;
