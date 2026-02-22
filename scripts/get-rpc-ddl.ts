import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    console.log('Fetching full source of exec_query...');
    const { data } = await supabase.rpc('exec_query', {
        p_sql: `
            SELECT 
                p.proname,
                p.prosrc,
                p.prosecdef,
                pg_get_function_arguments(p.oid) as args,
                pg_get_function_result(p.oid) as result_type
            FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'public' AND p.proname = 'exec_query'
        `
    });
    console.log('RPC DDL:', JSON.stringify(data, null, 2));
}

run();
