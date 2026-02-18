
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function listRPCs() {
    try {
        console.log('Listing RPC functions...');

        const sql = `
            CREATE TABLE IF NOT EXISTS public.diag_results (info text);
            DELETE FROM public.diag_results;
            INSERT INTO public.diag_results (info)
            SELECT proname || ' (' || pg_get_function_identity_arguments(p.oid) || ')'
            FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'public';
        `;

        await supabase.rpc('exec_sql', { sql_query: sql });

        console.log('Waiting for cache...');
        await new Promise(r => setTimeout(r, 2000));

        const { data, error } = await supabase.from('diag_results').select('*');

        if (error) {
            console.error('Error reading RPCs:', error);
        } else {
            console.log('Available RPCs:', JSON.stringify(data, null, 2));
        }

    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

listRPCs();
