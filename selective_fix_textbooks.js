
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function selectiveFix() {
    try {
        console.log('Starting selective fix (Table only)...');

        const sql = `
            -- 1. Create the table if it doesn't exist
            CREATE TABLE IF NOT EXISTS public.textbooks (
                id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                title TEXT NOT NULL,
                level TEXT NOT NULL CHECK (level IN ('PRIMARIA', 'SECUNDARIA', 'TELESECUNDARIA')),
                grade INTEGER NOT NULL,
                field_of_study TEXT,
                subject_id UUID REFERENCES public.subject_catalog(id) ON DELETE SET NULL,
                file_url TEXT NOT NULL,
                thumbnail_url TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            -- 2. Add columns to lesson_plans if missing
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_plans' AND column_name = 'textbook_id') THEN
                    ALTER TABLE public.lesson_plans ADD COLUMN textbook_id UUID REFERENCES public.textbooks(id) ON DELETE SET NULL;
                END IF;

                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_plans' AND column_name = 'textbook_pages_from') THEN
                    ALTER TABLE public.lesson_plans ADD COLUMN textbook_pages_from INTEGER;
                END IF;

                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_plans' AND column_name = 'textbook_pages_to') THEN
                    ALTER TABLE public.lesson_plans ADD COLUMN textbook_pages_to INTEGER;
                END IF;
            END $$;

            -- 3. Enable RLS
            ALTER TABLE public.textbooks ENABLE ROW LEVEL SECURITY;

            -- 4. Create policies (using IF NOT EXISTS logic via DO block or just DROP/CREATE)
            DO $$
            BEGIN
                DROP POLICY IF EXISTS "Allow authenticated users to read textbooks" ON public.textbooks;
                CREATE POLICY "Allow authenticated users to read textbooks" 
                ON public.textbooks FOR SELECT 
                TO authenticated 
                USING (true);

                DROP POLICY IF EXISTS "Allow superadmins to manage textbooks" ON public.textbooks;
                CREATE POLICY "Allow superadmins to manage textbooks" 
                ON public.textbooks FOR ALL 
                TO authenticated 
                USING (auth.jwt() ->> 'email' = 'helmerpersonal@gmail.com')
                WITH CHECK (auth.jwt() ->> 'email' = 'helmerpersonal@gmail.com');
            END $$;

            -- 5. Grant permissions
            GRANT ALL ON TABLE public.textbooks TO anon, authenticated, service_role;
            GRANT ALL ON TABLE public.lesson_plans TO anon, authenticated, service_role;
        `;

        const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

        if (error) {
            console.error('Selective fix failed:', error);
            process.exit(1);
        }

        console.log('Selective fix applied! Table and local policies should be ready.');
    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

selectiveFix();
