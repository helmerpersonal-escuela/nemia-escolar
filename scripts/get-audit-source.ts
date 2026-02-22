import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    const { data } = await supabase.rpc('exec_query', {
        p_sql: `
            SELECT proname, prosrc, pg_get_function_arguments(oid) as args
            FROM pg_proc 
            WHERE proname IN ('exec_sql', 'process_audit_log')
        `
    });

    fs.writeFileSync('scripts/audit-func-source.json', JSON.stringify(data, null, 2));
    console.log('Saved to scripts/audit-func-source.json');
}

run();
