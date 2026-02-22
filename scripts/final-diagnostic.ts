import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    const email = 'helmerferras@gmail.com';
    const { data: profile } = await supabase.rpc('exec_query', {
        p_sql: `SELECT * FROM profiles WHERE email = '${email}'`
    });
    console.log('--- PROFILE ---');
    console.log(JSON.stringify(profile, null, 2));

    if (profile && profile.length > 0) {
        const { data: pt } = await supabase.rpc('exec_query', {
            p_sql: `SELECT * FROM profile_tenants WHERE profile_id = '${profile[0].id}'`
        });
        console.log('--- PROFILE_TENANTS ---');
        console.log(JSON.stringify(pt, null, 2));
    }

    const { data: daniela } = await supabase.rpc('exec_query', {
        p_sql: `SELECT * FROM profiles WHERE full_name ILIKE '%Daniela%'`
    });
    console.log('--- DANIELA PROFILES ---');
    console.log(JSON.stringify(daniela, null, 2));
}

run();
