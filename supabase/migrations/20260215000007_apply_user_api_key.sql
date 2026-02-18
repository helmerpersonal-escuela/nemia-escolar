-- ACTUALIZACIÓN MANUAL DE API KEY PARA GEMINI
-- Este script asegura que la columna exista y aplica la clave proporcionada por el usuario.

-- 1. Asegurar que la columna ai_config exista en la tabla tenants
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS ai_config JSONB DEFAULT '{}'::jsonb;

-- 2. Aplicar la clave API a todos los registros existentes (en entorno de desarrollo/único tenant)
UPDATE public.tenants 
SET ai_config = jsonb_build_object('apiKey', 'AIzaSyDtfr1fhGJ8ktmjJQ0h0Rnx1f17SbSyBZ8')
WHERE ai_config IS NULL OR ai_config->>'apiKey' IS NULL OR ai_config->>'apiKey' = '';

-- nota: 'AIzaSyDtfr1fhGJ8ktmjJQ0h0Rnx1f17SbSyBZ8'
