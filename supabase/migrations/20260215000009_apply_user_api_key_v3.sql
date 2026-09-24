-- ACTUALIZACIÓN MANUAL DE API KEY (Nueva Clave Generada)

ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS ai_config JSONB DEFAULT '{}'::jsonb;

UPDATE public.tenants 
SET ai_config = '{"apiKey": "LLAVE_REDACTADA_ROTAR"}'::jsonb;
