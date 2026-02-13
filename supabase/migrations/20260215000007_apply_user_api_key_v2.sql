-- ACTUALIZACIÓN MANUAL DE API KEY PARA GEMINI (Versión Simplificada)
-- Este script asegura que la columna exista y aplica la clave proporcionada por el usuario.

ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS ai_config JSONB DEFAULT '{}'::jsonb;

UPDATE public.tenants 
SET ai_config = '{"apiKey": "AIzaSyDtfr1fhGJ8ktmjJQ0h0Rnx1f17SbSyBZ8"}'::jsonb;
