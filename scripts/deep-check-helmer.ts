import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    const email = 'helmerferras@gmail.com';
    console.log(`Deep check for email: ${email}`);

    // 1. Check profiles table
    const { data: profiles, error: pError } = await supabase.rpc('exec_query', {
        p_sql: `SELECT * FROM profiles WHERE email = '${email}'`
    });
    if (pError) console.error('Profiles Error:', pError);
    else console.log('PROFILES:', JSON.stringify(profiles, null, 2));

    if (profiles && profiles.length > 0) {
        const id = profiles[0].id;
        // 2. Check profile_tenants
        const { data: pts, error: ptError } = await supabase.rpc('exec_query', {
            p_sql: `SELECT * FROM profile_tenants WHERE profile_id = '${id}'`
        });
        if (ptError) console.error('PT Error:', ptError);
        else console.log('PROFILE_TENANTS:', JSON.stringify(pts, null, 2));

        // 3. Check Guardianship
        const { data: guards, error: gError } = await supabase.rpc('exec_query', {
            p_sql: `SELECT * FROM guardians WHERE user_id = '${id}'`
        });
        if (gError) console.error('Guardians Error:', gError);
        else console.log('GUARDIANS:', JSON.stringify(guards, null, 2));
    }
}

run();
