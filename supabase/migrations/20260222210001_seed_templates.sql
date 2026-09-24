-- Seed Data for Lesson Plan Templates (NEM Model)
-- Covering Primary (1-6), Secondary (1-3), Telesecundaria (1-3)

insert into public.lesson_plan_templates (title, educational_level, grade, subject_name, campo_formativo, metodologia, purpose, pda, activities_sequence) values

-- PRIMARIA 1º - ESPAÑOL
(
  'El nombre propio y su escritura', 
  'PRIMARY', 1, 'Español', 'Lenguajes', 
  'Aprendizaje Basado en Proyectos Community', 
  'Identificar el nombre propio y compararlo con el de otros compañeros.', 
  array['Escribe su nombre y lo compara con los nombres de sus compañeros.'],
  '[
    {
      "date": "Sesión 1",
      "phases": [
        {"name": "Apertura", "duration": 15, "activities": ["Lluvia de ideas sobre la importancia de tener un nombre.", "Presentación del abecedario en el aula."]},
        {"name": "Desarrollo", "duration": 30, "activities": ["Escritura del nombre en una tarjeta de cartulina.", "Comparación de letras iniciales con otros compañeros."]},
        {"name": "Cierre", "duration": 15, "activities": ["Colocar las tarjetas en el mural de asistencia."]}
      ]
    }
  ]'::jsonb
),

-- PRIMARIA 2º - MATEMÁTICAS
(
  'Los números hasta el 1000', 
  'PRIMARY', 2, 'Matemáticas', 'Saberes y Pensamiento Científico', 
  'Aprendizaje Basado en Indagación (STEAM)', 
  'Comprender la sucesión numérica hasta el 1000.', 
  array['Expresa oralmente la sucesión numérica hasta 1000, en español y hasta donde sea posible, en su lengua materna.'],
  '[
    {
      "date": "Sesión 1",
      "phases": [
        {"name": "Apertura", "duration": 15, "activities": ["Recuento de los números del 1 al 100.", "Planteamiento del reto: ¿Qué sigue después de 100?"]},
        {"name": "Desarrollo", "duration": 35, "activities": ["Uso de ábacos o material base 10 para formar centenas.", "Ejercicios de conteo de 10 en 10 hasta 500."]},
        {"name": "Cierre", "duration": 10, "activities": ["Dictado de números de tres cifras."]}
      ]
    }
  ]'::jsonb
),

-- PRIMARIA 3º - GANAR-GANAR (COMUNIDAD)
(
  'Acuerdos en la comunidad escolar', 
  'PRIMARY', 3, 'Formación Cívica y Ética', 'Ética, Naturaleza y Sociedades', 
  'Aprendizaje Servicio (AS)', 
  'Participar en la toma de decisiones para mejorar el entorno escolar.', 
  array['Comprende que la democracia se basa en la participación y el respeto a los derechos humanos.'],
  '[
    {
      "date": "Sesión 1",
      "phases": [
        {"name": "Apertura", "duration": 15, "activities": ["Identificación de un problema en el patio escolar.", "Discusión sobre reglas de convivencia."]},
        {"name": "Desarrollo", "duration": 30, "activities": ["Propuesta de soluciones en equipos.", "Simulacro de asamblea escolar para votar una solución."]},
        {"name": "Cierre", "duration": 15, "activities": ["Registro de los acuerdos logrados en el cuaderno."]}
      ]
    }
  ]'::jsonb
),

-- SECUNDARIA 1º - BIOLOGÍA
(
  'La célula: unidad de vida', 
  'SECONDARY', 1, 'Biología', 'Saberes y Pensamiento Científico', 
  'Aprendizaje Basado en Indagación (STEAM)', 
  'Relacionar la estructura de la célula con sus funciones básicas.', 
  array['Describe las estructuras y funciones básicas de la célula (membrana, citoplasma, núcleo, organelos).'],
  '[
    {
      "date": "Sesión 1",
      "phases": [
        {"name": "Apertura", "duration": 10, "activities": ["Observación de imágenes de seres microscópicos.", "Pregunta detonadora: ¿De qué estamos hechos?"]},
        {"name": "Desarrollo", "duration": 35, "activities": ["Elaboración de un modelo de célula con materiales reciclados.", "Identificación de funciones de la membrana y el núcleo."]},
        {"name": "Cierre", "duration": 15, "activities": ["Explicación en binas del modelo realizado."]}
      ]
    }
  ]'::jsonb
),

-- TELESECUNDARIA 2º - FÍSICA
(
  'Leyes de Newton en la vida diaria', 
  'TELESECUNDARIA', 2, 'Física', 'Saberes y Pensamiento Científico', 
  'Aprendizaje Basado en Indagación (STEAM)', 
  'Experimentar y comprender las leyes del movimiento.', 
  array['Interpreta las leyes de Newton y las integra para explicar el movimiento de los objetos.'],
  '[
    {
      "date": "Sesión 1",
      "phases": [
        {"name": "Apertura", "duration": 15, "activities": ["Ver video corto sobre la caída de los cuerpos.", "Discusión sobre qué es la inercia."]},
        {"name": "Desarrollo", "duration": 45, "activities": ["Experimento con monedas y hojas de papel para demostrar inercia.", "Cálculo de fuerza usando F=ma en ejemplos cotidianos."]},
        {"name": "Cierre", "duration": 15, "activities": ["Resolución de un crucigrama sobre leyes de Newton."]}
      ]
    }
  ]'::jsonb
)
ON CONFLICT DO NOTHING;
