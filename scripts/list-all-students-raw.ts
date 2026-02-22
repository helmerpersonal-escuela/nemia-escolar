import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    console.log('--- ALL STUDENTS (Bypassing RLS) ---');
    const { data, error } = await supabase.rpc('exec_query', {
        p_sql: "SELECT id, full_name, tenant_id FROM students"
    });

    if (error) {
        console.error('RPC ERROR:', error);
    } else {
        console.log('STUDENTS FOUND:', JSON.stringify(data, null, 2));
    }
}

run();
