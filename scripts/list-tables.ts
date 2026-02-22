import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    console.log('Finding tutor-related tables...');
    const { data: tables } = await supabase.rpc('exec_query', {
        p_sql: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%tutor%'"
    });
    console.log('TABLES:', JSON.stringify(tables, null, 2));

    const email = 'helmerferras@gmail.com';
    const { data: profile } = await supabase.rpc('exec_query', {
        p_sql: `SELECT id, full_name, role, tenant_id FROM profiles WHERE email = '${email}'`
    });
    console.log('PROFILE:', JSON.stringify(profile, null, 2));
}

run();
