import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    console.log('--- ALL PROFILES ---');
    const { data, error } = await supabase.rpc('exec_query', {
        p_sql: "SELECT id, email, first_name, role, tenant_id FROM profiles ORDER BY email"
    });
    if (error) console.error(error);
    else console.table(data);
}

run();
