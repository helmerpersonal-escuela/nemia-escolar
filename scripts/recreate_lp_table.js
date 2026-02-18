
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function run() {
    console.log('--- RECREATING LESSON_PLANS TABLE ---')

    const sql = `
    -- 1. DROP CASCADE
    DROP TABLE IF EXISTS public.lesson_plans CASCADE;

    -- 2. CREATE TABLE
    CREATE TABLE public.lesson_plans (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
        group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
        subject_id UUID REFERENCES public.subject_catalog(id) ON DELETE SET NULL,
        period_id UUID REFERENCES public.evaluation_periods(id) ON DELETE SET NULL,
        
        title TEXT NOT NULL DEFAULT 'Sin Título',
        temporality TEXT CHECK (temporality IN ('WEEKLY', 'MONTHLY', 'PROJECT')),
        start_date DATE,
        end_date DATE,
        
        campo_formativo TEXT,
        metodologia TEXT,
        problem_context TEXT,
        purpose TEXT,
        project_duration INTEGER DEFAULT 10,
        
        objectives JSONB DEFAULT '[]',
        contents JSONB DEFAULT '[]',
        pda JSONB DEFAULT '[]',
        ejes_articuladores JSONB DEFAULT '[]',
        activities_sequence JSONB DEFAULT '[]',
        resources TEXT[] DEFAULT '{}',
        evaluation_plan JSONB DEFAULT '{}',
        
        source_document_url TEXT,
        extracted_text TEXT,
        textbook_id UUID REFERENCES public.textbooks(id) ON DELETE SET NULL,
        textbook_pages_from TEXT,
        textbook_pages_to TEXT,
        
        status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SUBMITTED', 'APPROVED')),
        
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- 3. RLS
    ALTER TABLE public.lesson_plans ENABLE ROW LEVEL SECURITY;

    -- 4. POLICIES
    CREATE POLICY "Enable access for tenant users on lesson_plans" ON public.lesson_plans
    USING (auth.uid() IN (SELECT id FROM public.profiles WHERE tenant_id = lesson_plans.tenant_id))
    WITH CHECK (auth.uid() IN (SELECT id FROM public.profiles WHERE tenant_id = lesson_plans.tenant_id));

    -- 5. RELOAD CACHE
    NOTIFY pgrst, 'reload config';
    `;

    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
        console.error('Error recreating table:', error);
    } else {
        console.log('Lesson plans table recreated successfully with FULL SCHEMA.');
    }
}

run()
