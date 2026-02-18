-- INSERT DUMMY MERCADO PAGO TOKEN
-- Run this to prevent "Missing Token" error in Edge Function.
-- You should replace 'TEST-xxxx...' with your actual MP Access Token using the Dashboard or SQL.

INSERT INTO public.system_settings (key, value, description)
VALUES (
    'mercadopago_access_token', 
    'TEST-00000000-0000-0000-0000-000000000000', 
    'Mercado Pago Access Token (Sandbox/Production)'
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value;
