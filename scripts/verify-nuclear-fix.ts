import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    const email = 'helmerferras@gmail.com';
    console.log(`Checking both profiles for: ${email}`);

    const { data: profiles, error } = await supabase.rpc('exec_query', {
        p_sql: `SELECT id, email, first_name, full_name, role, tenant_id FROM profiles WHERE email = '${email}'`
    });

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('FINAL PROFILES STATE:');
    console.log(JSON.stringify(profiles, null, 2));

    const names = profiles?.map((p: any) => p.first_name);
    if (names?.includes('DANIELA')) {
        console.log('VERIFICATION FAILED: DANIELA STILL EXISTS');
    } else {
        console.log('VERIFICATION SUCCESS: DANIELA PURGED');
    }
}

run();
