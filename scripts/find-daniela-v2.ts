import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    console.log('Searching for profile with first_name DANIELA...');
    const { data: profiles, error } = await supabase.rpc('exec_query', {
        p_sql: "SELECT id, email, first_name, role FROM profiles WHERE first_name ILIKE '%DANIELA%'"
    });

    if (error) console.error(error);
    else console.log('DANIELA PROFILES:', JSON.stringify(profiles, null, 2));

    const helmerEmail = 'helmerferras@gmail.com';
    const { data: helmer } = await supabase.rpc('exec_query', {
        p_sql: `SELECT id, email, first_name, role FROM profiles WHERE email = '${helmerEmail}'`
    });
    console.log('HELMER CURRENT:', JSON.stringify(helmer, null, 2));
}

run();
