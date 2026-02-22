import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    console.log('Listing ALL functions in public schema with OIDs...');
    try {
        const { data, error } = await supabase.rpc('exec_query', {
            p_sql: "SELECT p.oid, proname, pg_get_function_arguments(p.oid) as args FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' ORDER BY proname"
        });
        if (error) console.error('RPC Error:', error);
        else console.log('FUNCTIONS:', JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Catch Error:', e);
    }
}

run();
