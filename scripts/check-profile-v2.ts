import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    const email = 'helmerferras@gmail.com';
    console.log(`Checking profile for: ${email}`);

    const { data: profiles, error } = await supabase.rpc('exec_query', {
        p_sql: `SELECT id, email, first_name, full_name, role, tenant_id FROM profiles WHERE email = '${email}'`
    });

    if (error) {
        console.error('Profiles Query Error:', error);
        return;
    }

    console.log('PROFILES FOUND:', profiles.length);
    console.log(JSON.stringify(profiles, null, 2));

    for (const p of profiles) {
        console.log(`\n--- Checking Tenants for ID: ${p.id} ---`);
        const { data: pt } = await supabase.rpc('exec_query', {
            p_sql: `SELECT pt.*, t.name as tenant_name FROM profile_tenants pt JOIN tenants t ON pt.tenant_id = t.id WHERE pt.profile_id = '${p.id}'`
        });
        console.log('PT ENTRIES:', JSON.stringify(pt, null, 2));
    }
}

run();
