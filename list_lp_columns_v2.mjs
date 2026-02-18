import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkColumns() {
    // Simpler approach: check if specific columns exist
    const colsToCheck = [
        'project_duration', 'purpose', 'temporality', 'textbook_id',
        'textbook_pages_from', 'textbook_pages_to', 'source_document_url', 'extracted_text'
    ];

    const results = {};

    for (const col of colsToCheck) {
        const sql = `SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_plans' AND column_name = '${col}')`;
        const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
        // Since exec_sql returns void, we use the leak technique again but simplified
        const leakSql = `DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_plans' AND column_name = '${col}') THEN RAISE EXCEPTION 'FOUND:${col}'; END IF; END $$;`;
        const { error: leakError } = await supabase.rpc('exec_sql', { sql_query: leakSql });
        results[col] = leakError?.message?.includes(`FOUND:${col}`) || false;
    }

    console.log('COLUMN STATUS:');
    console.log(JSON.stringify(results, null, 2));
}

checkColumns()
