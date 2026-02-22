import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    const emails = ['helmerferras@gmail.com', 'damahel2017@gmail.com'];
    console.log('--- CHECKING SPECIFIC PROFILES RAW ---');
    const { data, error } = await supabase.rpc('exec_query', {
        p_sql: `SELECT id, email, first_name, full_name, role, tenant_id FROM profiles WHERE email IN ('${emails.join("','")}')`
    });
    if (error) console.error(error);
    else console.log(JSON.stringify(data, null, 2));
}

run();
