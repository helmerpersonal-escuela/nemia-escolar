-- Migration: Create Evaluation Criteria Catalog
CREATE TABLE IF NOT EXISTS evaluation_criteria_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for faster lookups by tenant
CREATE INDEX IF NOT EXISTS idx_criteria_catalog_tenant ON evaluation_criteria_catalog(tenant_id);

-- Seed with standard entries (marking them as is_default potentially for all tenants or just global)
INSERT INTO evaluation_criteria_catalog (name, description, is_default) VALUES
('Conocimientos adquiridos', 'Dominio de conceptos y contenidos teóricos.', true),
('Habilidades y destrezas', 'Capacidad práctica para ejecutar tareas y procedimientos.', true),
('Comprensión lectora', 'Habilidad para entender e interpretar diversos tipos de textos.', true),
('Expresión oral', 'Capacidad de comunicar ideas de forma clara y coherente verbalmente.', true),
('Expresión escrita', 'Habilidad para redactar textos con corrección, coherencia y sentido.', true),
('Pensamiento crítico', 'Análisis, evaluación y síntesis de información de forma objetiva.', true),
('Resolución de problemas', 'Capacidad para encontrar soluciones efectivas a situaciones complejas.', true),
('Colaboración y trabajo en equipo', 'Habilidad para trabajar constructivamente con otros hacia una meta común.', true),
('Creatividad', 'Generación de ideas originales y soluciones innovadoras.', true),
('Reflexión metacognitiva', 'Capacidad de reflexionar sobre el propio proceso de aprendizaje.', true),
('Actitud y compromiso', 'Disposición hacia el aprendizaje y vinculación con las actividades.', true),
('Autonomía en el aprendizaje', 'Capacidad de gestionar el propio aprendizaje de forma independiente.', true),
('Uso de recursos', 'Manejo efectivo de herramientas, materiales y tecnologías.', true),
('Aplicación en contextos reales', 'Habilidad para transferir lo aprendido a situaciones de la vida cotidiana.', true),
('Interculturalidad e inclusión', 'Respeto a la diversidad y fomento de un ambiente inclusivo.', true),
('Responsabilidad y puntualidad', 'Cumplimiento de compromisos y tiempos establecidos.', true),
('Evolución y mejora continua', 'Progreso evidenciado a lo largo del tiempo en el aprendizaje.', true)
ON CONFLICT DO NOTHING;
