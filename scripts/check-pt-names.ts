import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    console.log('Searching for "Daniela" in profile_tenants...');
    const { data: ptDaniela, error: e1 } = await supabase.rpc('exec_query', {
        p_sql: "SELECT pt.*, p.email FROM profile_tenants pt JOIN profiles p ON pt.profile_id = p.id WHERE pt.first_name ILIKE '%Daniela%'"
    });
    if (e1) console.error(e1);
    else console.log('PT DANIELA:', JSON.stringify(ptDaniela, null, 2));

    console.log('Searching for any profile_tenants linked to helmerferras@gmail.com...');
    const { data: ptHelmer, error: e2 } = await supabase.rpc('exec_query', {
        p_sql: "SELECT pt.*, p.full_name as profile_full_name FROM profile_tenants pt JOIN profiles p ON pt.profile_id = p.id WHERE p.email = 'helmerferras@gmail.com'"
    });
    if (e2) console.error(e2);
    else console.log('PT HELMER:', JSON.stringify(ptHelmer, null, 2));

    console.log('Checking profiles for "Daniela"...');
    const { data: pDaniela } = await supabase.rpc('exec_query', {
        p_sql: "SELECT id, email, full_name, role FROM profiles WHERE full_name ILIKE '%Daniela%' OR first_name ILIKE '%Daniela%'"
    });
    console.log('P DANIELA:', JSON.stringify(pDaniela, null, 2));
}

run();
