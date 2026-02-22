import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    console.log('Searching for "Daniela" in profiles...');
    const { data: daniela, error: dError } = await supabase.rpc('exec_query', {
        p_sql: "SELECT id, email, full_name, role FROM profiles WHERE full_name ILIKE '%Daniela%'"
    });
    if (dError) console.error(dError);
    else console.table(daniela);

    console.log('Checking all roles assigned to helmerferras@gmail.com...');
    const email = 'helmerferras@gmail.com';
    const { data: roles, error: rError } = await supabase.rpc('exec_query', {
        p_sql: `
            SELECT 'profiles' as source, role FROM profiles WHERE email = '${email}'
            UNION ALL
            SELECT 'profile_tenants' as source, pt.role FROM profile_tenants pt JOIN profiles p ON pt.profile_id = p.id WHERE p.email = '${email}'
        `
    });
    if (rError) console.error(rError);
    else console.table(roles);
}

run();
