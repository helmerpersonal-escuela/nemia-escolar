-- Aviso del asesor de seguridad: search_path fijo en una función pura (sin tablas).
ALTER FUNCTION public.demo_visit_records(jsonb, text, jsonb) SET search_path = '';
