import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    const email = 'helmerferras@gmail.com';
    console.log(`Checking profile for ${email}...`);

    const { data: profiles, error: pError } = await supabase.rpc('exec_query', {
        p_sql: `SELECT id, email, full_name, role, tenant_id FROM profiles WHERE email = '${email}'`
    });

    if (pError) {
        console.error('Error fetching profile:', pError);
    } else {
        console.log('PROFILES FOUND:', profiles.length);
        console.table(profiles);

        for (const p of profiles) {
            console.log(`Checking tenants for profile ID: ${p.id}`);
            const { data: pt, error: ptError } = await supabase.rpc('exec_query', {
                p_sql: `SELECT pt.profile_id, pt.tenant_id, pt.role as pt_role, t.name as tenant_name 
                        FROM profile_tenants pt 
                        JOIN tenants t ON pt.tenant_id = t.id 
                        WHERE pt.profile_id = '${p.id}'`
            });
            if (ptError) console.error('Error fetching pt:', ptError);
            else console.table(pt);
        }
    }
}

run();
