
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function run() {
    console.log('--- FORCING SCHEMA RELOAD ---')

    const sql = `
    DO $$ 
    BEGIN 
        -- Ensure activities_sequence exists
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_plans' AND column_name = 'activities_sequence') THEN 
            ALTER TABLE public.lesson_plans ADD COLUMN activities_sequence JSONB DEFAULT '[]'; 
        END IF; 

        -- Ensure Textbook columns (sometimes they fail if added as INTEGER and empty strings are sent)
        -- We'll try to ensure they are there. If they are already INTEGER, we leave them.
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_plans' AND column_name = 'textbook_pages_from') THEN 
            ALTER TABLE public.lesson_plans ADD COLUMN textbook_pages_from TEXT; 
        END IF; 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_plans' AND column_name = 'textbook_pages_to') THEN 
            ALTER TABLE public.lesson_plans ADD COLUMN textbook_pages_to TEXT; 
        END IF; 

        -- Force cache reload
        NOTIFY pgrst, 'reload config'; 
    END $$;
    `;

    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
        console.error('Error forcing reload:', error);
    } else {
        console.log('Force reload command sent successfully.');
    }
}

run()
