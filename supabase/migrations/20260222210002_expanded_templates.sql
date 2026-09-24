-- Comprehensive Lesson Plan Template Bank (NEM)
-- This script adds templates for all major subjects and grades

BEGIN;

-- CLEANUP PREVIOUS SEED (Optional, keep if you want to replace)
-- TRUNCATE public.lesson_plan_templates;

INSERT INTO public.lesson_plan_templates (title, educational_level, grade, subject_name, campo_formativo, metodologia, purpose, pda, activities_sequence) VALUES

-- PRIMARIA 1º
('Mi comunidad y mis raíces', 'PRIMARY', 1, 'Español', 'Lenguajes', 'Aprendizaje Basado en Proyectos Community', 'Explorar la identidad personal y comunitaria.', ARRAY['Identifica elementos de su comunidad en su lengua materna.'], '[{"date": "Sesión 1", "phases": [{"name": "Apertura", "duration": 20, "activities": ["Narración de un cuento local."]}, {"name": "Desarrollo", "duration": 30, "activities": ["Dibujo de un lugar significativo de la comunidad."]}, {"name": "Cierre", "duration": 10, "activities": ["Compartir el dibujo en círculo."]}]}]'::jsonb),
('Aprendiendo a contar con objetos', 'PRIMARY', 1, 'Matemáticas', 'Saberes y Pensamiento Científico', 'Aprendizaje Basado en Indagación (STEAM)', 'Desarrollar el sentido numérico inicial.', ARRAY['Cuenta colecciones de hasta 20 elementos.'], '[{"date": "Sesión 1", "phases": [{"name": "Apertura", "duration": 15, "activities": ["Juego de contar pasos."]}, {"name": "Desarrollo", "duration": 35, "activities": ["Agrupar semillas o fichas en decenas."]}, {"name": "Cierre", "duration": 10, "activities": ["Registro numérico en el cuaderno."]}]}]'::jsonb),

-- PRIMARIA 2º
('Cuidemos el agua en la escuela', 'PRIMARY', 2, 'Ciencias Naturales', 'Saberes y Pensamiento Científico', 'Aprendizaje Basado en Proyectos Community', 'Fomentar la conciencia ambiental.', ARRAY['Propone acciones para el cuidado del agua.'], '[{"date": "Sesión 1", "phases": [{"name": "Apertura", "duration": 10, "activities": ["Recorrido por los bebederos."]}, {"name": "Desarrollo", "duration": 40, "activities": ["Elaboración de carteles preventivos."]}, {"name": "Cierre", "duration": 10, "activities": ["Pegado de carteles en áreas clave."]}]}]'::jsonb),

-- PRIMARIA 3º
('Los pueblos originarios de mi estado', 'PRIMARY', 3, 'Historia', 'Ética, Naturaleza y Sociedades', 'Aprendizaje Basado en Problemas (ABP)', 'Valorar la diversidad cultural.', ARRAY['Reconoce la presencia de pueblos indígenas en su entidad.'], '[{"date": "Sesión 1", "phases": [{"name": "Apertura", "duration": 15, "activities": ["Observación de mapas históricos."]}, {"name": "Desarrollo", "duration": 30, "activities": ["Investigación sobre una tradición local."]}, {"name": "Cierre", "duration": 15, "activities": ["Exposición de un objeto o prenda típica."]}]}]'::jsonb),

-- PRIMARIA 4º
('Nutrición y vida saludable', 'PRIMARY', 4, 'Vida Saludable', 'De lo Humano y lo Comunitario', 'Aprendizaje Basado en Proyectos Community', 'Promover hábitos alimenticios correctos.', ARRAY['Explica la importancia del consumo de agua simple potable.'], '[{"date": "Sesión 1", "phases": [{"name": "Apertura", "duration": 15, "activities": ["Análisis de etiquetas de refrescos."]}, {"name": "Desarrollo", "duration": 30, "activities": ["Cálculo de azúcar en bebidas comunes."]}, {"name": "Cierre", "duration": 15, "activities": ["Compromiso grupal de beber agua pura."]}]}]'::jsonb),

-- PRIMARIA 5º
('Sistemas del cuerpo humano', 'PRIMARY', 5, 'Ciencias Naturales', 'Saberes y Pensamiento Científico', 'Aprendizaje Basado en Indagación (STEAM)', 'Entender el funcionamiento del sistema digestivo.', ARRAY['Explica la participación del sistema digestivo en el aprovechamiento de alimentos.'], '[{"date": "Sesión 1", "phases": [{"name": "Apertura", "duration": 10, "activities": ["Simulación de la masticación con una bolsa."]}, {"name": "Desarrollo", "duration": 40, "activities": ["Construcción de un diagrama del tracto digestivo."]}, {"name": "Cierre", "duration": 10, "activities": ["Preguntas de opción múltiple de repaso."]}]}]'::jsonb),

-- PRIMARIA 6º
('Equidad de género en el aula', 'PRIMARY', 6, 'Formación Cívica y Ética', 'Ética, Naturaleza y Sociedades', 'Aprendizaje Basado en Problemas (ABP)', 'Fomentar el respeto y la igualdad.', ARRAY['Analiza situaciones de desigualdad de género.'], '[{"date": "Sesión 1", "phases": [{"name": "Apertura", "duration": 15, "activities": ["Debate guiado sobre roles familiares."]}, {"name": "Desarrollo", "duration": 35, "activities": ["Análisis de casos reales de discriminación."]}, {"name": "Cierre", "duration": 10, "activities": ["Redacción de un decálogo de equidad."]}]}]'::jsonb),

-- SECUNDARIA 1º
('Resolución de conflictos sociales', 'SECONDARY', 1, 'Formación Cívica y Ética', 'Ética, Naturaleza y Sociedades', 'Aprendizaje Basado en Problemas (ABP)', 'Desarrollar habilidades de mediación.', ARRAY['Comprende la importancia de la mediación en los conflictos.'], '[{"date": "Sesión 1", "phases": [{"name": "Apertura", "duration": 10, "activities": ["Dinámica de 'El nudo humano'."]}, {"name": "Desarrollo", "duration": 35, "activities": ["Role-playing de un conflicto escolar."]}, {"name": "Cierre", "duration": 15, "activities": ["Reflexión escrita sobre la empatía."]}]}]'::jsonb),

-- SECUNDARIA 2º
('Manifestaciones literarias en español', 'SECONDARY', 2, 'Español', 'Lenguajes', 'Aprendizaje Basado en Proyectos Community', 'Apreciar la literatura hispana.', ARRAY['Valora la diversidad de expresiones literarias en español.'], '[{"date": "Sesión 1", "phases": [{"name": "Apertura", "duration": 15, "activities": ["Lectura de un poema de Octavio Paz."]}, {"name": "Desarrollo", "duration": 35, "activities": ["Análisis de figuras retóricas en canciones."]}, {"name": "Cierre", "duration": 10, "activities": ["Creación de una metáfora propia."]}]}]'::jsonb),

-- SECUNDARIA 3º
('Ecuaciones de segundo grado', 'SECONDARY', 3, 'Matemáticas', 'Saberes y Pensamiento Científico', 'Aprendizaje Basado en Indagación (STEAM)', 'Resolver problemas con ecuaciones cuadráticas.', ARRAY['Resuelve problemas de ecuaciones cuadráticas mediante diversos métodos.'], '[{"date": "Sesión 1", "phases": [{"name": "Apertura", "duration": 10, "activities": ["Repaso de factorización simple."]}, {"name": "Desarrollo", "duration": 40, "activities": ["Uso de la fórmula general en problemas físicos."]}, {"name": "Cierre", "duration": 10, "activities": ["Autoevaluación de ejercicios."]}]}]'::jsonb)

ON CONFLICT DO NOTHING;

COMMIT;
