
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function applyFix() {
    console.log('Applying COMPREHENSIVE schema fix to lesson_plans...')

    const sql = `
    DO $$
    DECLARE
        col_name TEXT;
    BEGIN
        -- title
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_plans' AND column_name = 'title') THEN
            ALTER TABLE public.lesson_plans ADD COLUMN title TEXT DEFAULT 'Sin Título';
        END IF;

        -- temporality
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_plans' AND column_name = 'temporality') THEN
            ALTER TABLE public.lesson_plans ADD COLUMN temporality TEXT CHECK (temporality IN ('WEEKLY', 'MONTHLY', 'PROJECT'));
        END IF;

        -- start_date
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_plans' AND column_name = 'start_date') THEN
            ALTER TABLE public.lesson_plans ADD COLUMN start_date DATE;
        END IF;

        -- end_date
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_plans' AND column_name = 'end_date') THEN
            ALTER TABLE public.lesson_plans ADD COLUMN end_date DATE;
        END IF;

        -- campo_formativo
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_plans' AND column_name = 'campo_formativo') THEN
            ALTER TABLE public.lesson_plans ADD COLUMN campo_formativo TEXT;
        END IF;

        -- metodologia
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_plans' AND column_name = 'metodologia') THEN
            ALTER TABLE public.lesson_plans ADD COLUMN metodologia TEXT;
        END IF;

        -- problem_context
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_plans' AND column_name = 'problem_context') THEN
            ALTER TABLE public.lesson_plans ADD COLUMN problem_context TEXT;
        END IF;

        -- JSONB columns (explicitly unrolled for safety)
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_plans' AND column_name = 'objectives') THEN
            ALTER TABLE public.lesson_plans ADD COLUMN objectives JSONB DEFAULT '[]';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_plans' AND column_name = 'contents') THEN
            ALTER TABLE public.lesson_plans ADD COLUMN contents JSONB DEFAULT '[]';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_plans' AND column_name = 'pda') THEN
            ALTER TABLE public.lesson_plans ADD COLUMN pda JSONB DEFAULT '[]';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_plans' AND column_name = 'ejes_articuladores') THEN
            ALTER TABLE public.lesson_plans ADD COLUMN ejes_articuladores JSONB DEFAULT '[]';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_plans' AND column_name = 'activities_sequence') THEN
            ALTER TABLE public.lesson_plans ADD COLUMN activities_sequence JSONB DEFAULT '[]';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_plans' AND column_name = 'evaluation_plan') THEN
            ALTER TABLE public.lesson_plans ADD COLUMN evaluation_plan JSONB DEFAULT '{}';
        END IF;

        -- resources (TEXT[])
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_plans' AND column_name = 'resources') THEN
            ALTER TABLE public.lesson_plans ADD COLUMN resources TEXT[] DEFAULT '{}';
        END IF;

        -- PDF columns
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_plans' AND column_name = 'source_document_url') THEN
            ALTER TABLE public.lesson_plans ADD COLUMN source_document_url TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_plans' AND column_name = 'extracted_text') THEN
            ALTER TABLE public.lesson_plans ADD COLUMN extracted_text TEXT;
        END IF;

        -- Textbook columns
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_plans' AND column_name = 'textbook_id') THEN
            ALTER TABLE public.lesson_plans ADD COLUMN textbook_id UUID REFERENCES public.textbooks(id) ON DELETE SET NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_plans' AND column_name = 'textbook_pages_from') THEN
            ALTER TABLE public.lesson_plans ADD COLUMN textbook_pages_from TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_plans' AND column_name = 'textbook_pages_to') THEN
            ALTER TABLE public.lesson_plans ADD COLUMN textbook_pages_to TEXT;
        END IF;

        -- project columns
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_plans' AND column_name = 'project_duration') THEN
            ALTER TABLE public.lesson_plans ADD COLUMN project_duration INTEGER DEFAULT 10;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_plans' AND column_name = 'purpose') THEN
            ALTER TABLE public.lesson_plans ADD COLUMN purpose TEXT;
        END IF;

        -- Reload schema cache
        NOTIFY pgrst, 'reload config';
    END $$;
    `

    const { error } = await supabase.rpc('exec_sql', { sql_query: sql })

    if (error) {
        console.error('Error applying comprehensive fix:', error)
    } else {
        console.log('Comprehensive schema fix applied successfully!')
    }
}

applyFix()
