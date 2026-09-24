-- Agrega TELESECUNDARIA al nivel educativo de la escuela.
-- (Ajustado el 23/09/2026: conserva los niveles y tipos de mensaje que ya existían en producción.)
ALTER TABLE public.tenants DROP CONSTRAINT IF EXISTS tenants_educational_level_check;
ALTER TABLE public.tenants ADD CONSTRAINT tenants_educational_level_check CHECK (educational_level = ANY (ARRAY[
  'PRESCHOOL', 'PRIMARY', 'SECONDARY', 'TELESECUNDARIA', 'HIGH_SCHOOL', 'UNIVERSITY', 'OTHER'
]));

ALTER TABLE public.chat_messages DROP CONSTRAINT IF EXISTS chat_messages_type_check;
ALTER TABLE public.chat_messages ADD CONSTRAINT chat_messages_type_check CHECK (type = ANY (ARRAY[
  'TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT', 'REPORT', 'STICKER', 'FILE', 'SYSTEM', 'NOTIFICATION', 'WELCOME'
]));
