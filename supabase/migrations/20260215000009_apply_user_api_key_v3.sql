-- ACTUALIZACIÓN MANUAL DE API KEY (Nueva Clave Generada)

ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS ai_config JSONB DEFAULT '{}'::jsonb;

UPDATE public.tenants 
SET ai_config = '{"apiKey": "AIzaSyDNKMWJ_x-03P4r8G7shyxeVi3Wxf--70c"}'::jsonb;
