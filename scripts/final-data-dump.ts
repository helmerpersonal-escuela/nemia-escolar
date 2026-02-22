import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    const email = 'helmerferras@gmail.com';
    console.log(`--- FINAL DATA DUMP FOR ${email} ---`);

    // 1. Auth Metadata Fix
    console.log('Fixing Auth Metadata...');
    await supabase.rpc('exec_sql', {
        sql_query: `UPDATE auth.users SET raw_user_meta_data = raw_user_meta_data || '{"firstName":"HELMER", "full_name":"HELMER FERRAS COUTIÑO"}'::jsonb WHERE email = '${email}'`
    });

    // 2. Profiles check
    const { data: profiles } = await supabase.from('profiles').select('*').eq('email', email);
    console.log('PROFILES:', JSON.stringify(profiles, null, 2));

    // 3. PT check
    if (profiles) {
        for (const p of profiles) {
            const { data: pt } = await supabase.from('profile_tenants').select('*, tenants(name)').eq('profile_id', p.id);
            console.log(`PT for ID ${p.id}:`, JSON.stringify(pt, null, 2));
        }
    }

    // 4. Any other DANIELA?
    const { data: others } = await supabase.from('profiles').select('id, email, first_name').ilike('first_name', '%DANIELA%');
    console.log('OTHER DANIELA PROFILES:', JSON.stringify(others, null, 2));
}

run();
