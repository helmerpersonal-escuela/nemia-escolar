import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    console.log('Checking specifically for exec_sql and process_audit_log...');
    const { data } = await supabase.rpc('exec_query', {
        p_sql: `
            SELECT proname, prosrc 
            FROM pg_proc 
            WHERE proname IN ('exec_sql', 'process_audit_log')
        `
    });
    console.log('Result:', JSON.stringify(data, null, 2));
}

run();
