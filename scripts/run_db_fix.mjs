
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://aveqziaewxcglhteufft.supabase.co";
const supabaseAnonKey = "sb_publishable_0j3xzu-npRzqahLp5M6NRg_ea1bMw1J";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const sql = `
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE table_name = 'lesson_plans' 
        AND constraint_name = 'lesson_plans_subject_id_fkey'
    ) THEN
        ALTER TABLE public.lesson_plans DROP CONSTRAINT lesson_plans_subject_id_fkey;
    END IF;
END $$;
`;

async function run() {
    console.log("Running migration using anon key via exec_sql RPC...");
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
        console.error("Migration failed:", error);
    } else {
        console.log("Migration successful!");
    }
}

run();
