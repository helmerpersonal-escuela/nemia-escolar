import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    console.log('--- FINAL IDENTITY VERIFICATION ---');

    const emails = ['helmerpersonal@gmail.com', 'helmerferras@gmail.com', 'damahel2017@gmail.com'];

    // 1. Profile Check
    const { data: profiles } = await supabase.from('profiles').select('email, first_name, role').in('email', emails);
    console.log('Profiles:', JSON.stringify(profiles, null, 2));

    // 2. Auth Metadata Check
    const { data: users } = await supabase.rpc('exec_query', {
        p_sql: "SELECT email, raw_user_meta_data->>'firstName' as firstName FROM auth.users"
    });
    console.log('Auth Metadata:', JSON.stringify(users, null, 2));
}

run();
