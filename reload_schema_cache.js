
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function reloadSchemaCache() {
    try {
        console.log('Attempting to force schema cache reload...');

        // Running a dummy DDL operation to trigger PostgREST cache reload
        const sql = `
            CREATE TABLE IF NOT EXISTS public.reload_trigger (id int);
            DROP TABLE public.reload_trigger;
        `;

        const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

        if (error) {
            console.error('Error triggering reload:', error);
            process.exit(1);
        }

        console.log('Successfully triggered DDL operation. Wait a few seconds and try again.');
    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

reloadSchemaCache();
