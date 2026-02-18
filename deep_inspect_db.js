
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function deepInspect() {
    try {
        console.log('Deep inspecting for textbooks table...');

        // I'll use exec_sql to print to console via a custom error or just try to find it.
        // Since exec_sql is void, I'll use it to create a permanent diagnostic table.

        const sql = `
            CREATE TABLE IF NOT EXISTS public.diag_results (info text);
            DELETE FROM public.diag_results;
            INSERT INTO public.diag_results (info)
            SELECT schemaname || '.' || tablename || ' (Owner: ' || tableowner || ')'
            FROM pg_catalog.pg_tables
            WHERE tablename LIKE '%textbook%';
        `;

        await supabase.rpc('exec_sql', { sql_query: sql });

        // Now select from diag_results (hopefully this table appears in cache or I can wait)
        console.log('Waiting for diag_results to appear in cache...');
        let found = false;
        for (let i = 0; i < 5; i++) {
            const { data, error } = await supabase.from('diag_results').select('*');
            if (!error) {
                console.log('Diagnostic Results:', JSON.stringify(data, null, 2));
                found = true;
                break;
            }
            console.log('diag_results not yet in cache, retrying...');
            await new Promise(r => setTimeout(r, 2000));
        }

        if (!found) {
            console.log('Could not read diagnostic results from cache.');
        }

    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

deepInspect();
