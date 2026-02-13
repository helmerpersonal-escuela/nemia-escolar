-- Create system_settings table for global configurations
CREATE TABLE IF NOT EXISTS public.system_settings (
    key text PRIMARY KEY,
    value text NOT NULL,
    description text,
    updated_at timestamp with time zone DEFAULT now()
);

-- Seed SMTP keys with empty/default values
INSERT INTO public.system_settings (key, value, description) VALUES
('smtp_host', '', 'Servidor SMTP (ej. smtp.gmail.com)'),
('smtp_port', '587', 'Puerto SMTP (587 para STARTTLS, 465 para SSL)'),
('smtp_user', '', 'Usuario de autenticación SMTP'),
('smtp_pass', '', 'Contraseña de autenticación SMTP'),
('smtp_crypto', 'STARTTLS', 'Tipo de encriptación (NONE, SSL, TLS, STARTTLS)'),
('smtp_from_email', '', 'Correo electrónico del remitente'),
('smtp_from_name', 'EduManager Notificaciones', 'Nombre mostrado como remitente')
ON CONFLICT (key) DO NOTHING;

-- RLS: Only SuperAdmins (or users with specific role) can manage settings
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'system_settings' AND policyname = 'Admins can manage system settings'
    ) THEN
        CREATE POLICY "Admins can manage system settings" ON public.system_settings
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'ADMIN'
    )
);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'system_settings' AND policyname = 'Public read for system settings'
    ) THEN
        CREATE POLICY "Public read for system settings" ON public.system_settings
FOR SELECT
USING (true);
    END IF;
END $$; -- Needed for Edge Functions to read settings
