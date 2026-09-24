-- Drop if exists (development only, safe to remove in production migrations)
-- DROP TABLE IF EXISTS public.synthetic_programs_pdfs CASCADE;

CREATE TABLE IF NOT EXISTS public.synthetic_programs_pdfs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    phase INTEGER NOT NULL UNIQUE CHECK (phase >= 1 AND phase <= 6),
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    extracted_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- RLS Policies
ALTER TABLE public.synthetic_programs_pdfs ENABLE ROW LEVEL SECURITY;

-- Everyone can read
DROP POLICY IF EXISTS "Enable read access for all users on synthetic_programs_pdfs" ON public.synthetic_programs_pdfs;
CREATE POLICY "Enable read access for all users on synthetic_programs_pdfs" ON public.synthetic_programs_pdfs
    FOR SELECT USING (true);

-- Only Super Admins can insert/update/delete
DROP POLICY IF EXISTS "Enable insert for super admins on synthetic_programs_pdfs" ON public.synthetic_programs_pdfs;
CREATE POLICY "Enable insert for super admins on synthetic_programs_pdfs" ON public.synthetic_programs_pdfs
    FOR INSERT WITH CHECK (public.is_god_mode());

DROP POLICY IF EXISTS "Enable update for super admins on synthetic_programs_pdfs" ON public.synthetic_programs_pdfs;
CREATE POLICY "Enable update for super admins on synthetic_programs_pdfs" ON public.synthetic_programs_pdfs
    FOR UPDATE USING (public.is_god_mode());

DROP POLICY IF EXISTS "Enable delete for super admins on synthetic_programs_pdfs" ON public.synthetic_programs_pdfs;
CREATE POLICY "Enable delete for super admins on synthetic_programs_pdfs" ON public.synthetic_programs_pdfs
    FOR DELETE USING (public.is_god_mode());
    
-- Set up Storage Bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('synthetic-programs', 'synthetic-programs', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies for synthetic-programs bucket
-- Drop policies if they exist (safe for re-running)
DROP POLICY IF EXISTS "Public Access Synthetic Programs" ON storage.objects;
DROP POLICY IF EXISTS "Super Admin Insert Synthetic Programs" ON storage.objects;
DROP POLICY IF EXISTS "Super Admin Delete Synthetic Programs" ON storage.objects;

CREATE POLICY "Public Access Synthetic Programs" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'synthetic-programs');

CREATE POLICY "Super Admin Insert Synthetic Programs" 
ON storage.objects FOR INSERT 
WITH CHECK (
    bucket_id = 'synthetic-programs' 
    AND (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'SUPER_ADMIN'))
);

CREATE POLICY "Super Admin Delete Synthetic Programs" 
ON storage.objects FOR DELETE 
USING (
    bucket_id = 'synthetic-programs' 
    AND (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'SUPER_ADMIN'))
);
