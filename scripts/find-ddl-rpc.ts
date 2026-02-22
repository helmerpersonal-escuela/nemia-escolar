import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    console.log('Searching for DDL-capable RPCs (v2)...');
    const keywords = ['exec', 'run', 'sql', 'query', 'admin', 'manage', 'force', 'system'];
    const whereClause = keywords.map(k => `p.proname ILIKE '%${k}%'`).join(' OR ');

    const sql = `
        SELECT p.proname, pg_get_function_arguments(p.oid) as args 
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' 
        AND (${whereClause})
        ORDER BY p.proname
    `;

    const { data, error } = await supabase.rpc('exec_query', { p_sql: sql });

    if (error) {
        console.error('RPC Error:', error);
    } else {
        console.log('Matches found:', data?.length || 0);
        console.log(JSON.stringify(data, null, 2));
    }
}

run();
