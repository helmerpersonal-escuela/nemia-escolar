-- ==========================================
-- UPDATE: PRIMARY SUBJECT CATALOG
-- ==========================================

BEGIN;

-- 1. Actualizar nombres existentes para coincidir con preferencias del usuario
UPDATE public.subject_catalog SET name = 'Español / Lengua Materna' WHERE name = 'Español' AND educational_level = 'PRIMARY';
UPDATE public.subject_catalog SET name = 'Artes (antes Educación Artística)' WHERE name = 'Artes' AND educational_level = 'PRIMARY';
UPDATE public.subject_catalog SET name = 'Inglés (Lengua Extranjera)' WHERE name = 'Inglés' AND educational_level = 'PRIMARY';

-- 2. Manejar Educación Socioemocional / Vida Saludable
-- Intentamos unificar si el usuario lo prefiere como un solo bloque, 
-- pero mantendremos la flexibilidad permitiendo que existan ambos o uno combinado.
-- Borramos los individuales para insertar el unificado o actualizamos uno.
DELETE FROM public.subject_catalog WHERE name IN ('Educación Socioemocional', 'Vida Saludable') AND educational_level = 'PRIMARY';

insert into public.subject_catalog (name, educational_level, field_of_study, requires_specification) values
('Educación Socioemocional / Vida Saludable', 'PRIMARY', 'De lo Humano y lo Comunitario', false),
('Tecnología', 'PRIMARY', 'De lo Humano y lo Comunitario', true),
('Otra Materia / Actividad', 'PRIMARY', 'Complementaria', true)
ON CONFLICT (name, educational_level) DO NOTHING;

-- Asegurar que los que faltan estén con el nombre exacto solicitado por el usuario si no estaban
insert into public.subject_catalog (name, educational_level, field_of_study, requires_specification) values
('Ciencias Naturales', 'PRIMARY', 'Saberes y Pensamiento Científico', false),
('Historia', 'PRIMARY', 'Ética, Naturaleza y Sociedades', false),
('Geografía', 'PRIMARY', 'Ética, Naturaleza y Sociedades', false),
('Formación Cívica y Ética', 'PRIMARY', 'Ética, Naturaleza y Sociedades', false)
ON CONFLICT (name, educational_level) DO NOTHING;

COMMIT;

NOTIFY pgrst, 'reload schema';
