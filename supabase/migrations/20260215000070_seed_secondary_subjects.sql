-- Migración para insertar materias oficiales de Secundaria
INSERT INTO public.subject_catalog (name, educational_level, field_of_study)
VALUES
    ('TECNOLOGÍA', 'SECONDARY', 'De lo Humano y lo Comunitario'),
    ('ESPAÑOL', 'SECONDARY', 'Lenguajes'),
    ('INGLES', 'SECONDARY', 'Lenguajes'),
    ('TUTORÍA', 'SECONDARY', 'De lo Humano y lo Comunitario'),
    ('MATEMÁTICAS', 'SECONDARY', 'Saberes y Pensamiento Científico'),
    ('BIOLOGÍA', 'SECONDARY', 'Saberes y Pensamiento Científico'),
    ('FÍSICA', 'SECONDARY', 'Saberes y Pensamiento Científico'),
    ('QUÍMICA', 'SECONDARY', 'Saberes y Pensamiento Científico'),
    ('HISTORIA', 'SECONDARY', 'Ética, Naturaleza y Sociedades'),
    ('FORMACIÓN CÍVICA Y ÉTICA', 'SECONDARY', 'Ética, Naturaleza y Sociedades'),
    ('AUTONOMÍA CURRICULAR', 'SECONDARY', 'De lo Humano y lo Comunitario'),
    ('GEOGRAFÍA', 'SECONDARY', 'Ética, Naturaleza y Sociedades'),
    ('EDUCACIÓN FÍSICA', 'SECONDARY', 'De lo Humano y lo Comunitario'),
    ('ARTES', 'SECONDARY', 'Lenguajes')
ON CONFLICT (name, educational_level) DO NOTHING;
