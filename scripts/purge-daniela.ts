import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    const email = 'helmerferras@gmail.com';
    console.log(`Deep check for ${email}...`);

    const { data: profile, error } = await supabase.rpc('exec_query', {
        p_sql: `SELECT id, email, full_name, first_name, last_name_paternal, role, tenant_id FROM profiles WHERE email = '${email}'`
    });

    if (error) {
        console.error(error);
        return;
    }

    console.log('PROFILE DATA:', JSON.stringify(profile, null, 2));

    if (profile && profile.length > 0) {
        const p = profile[0];
        if (p.first_name === 'DANIELA' || p.full_name?.includes('DANIELA')) {
            console.log('FOUND DANIELA TRACES. Fixing...');
            const { error: uError } = await supabase.rpc('exec_sql', {
                p_sql: `
                    UPDATE profiles 
                    SET 
                        first_name = 'HELMER',
                        full_name = 'HELMER FERRAS CABRERA',
                        role = 'TUTOR'
                    WHERE id = '${p.id}'
                `
            });
            if (uError) console.error('Update failed:', uError);
            else console.log('Successfully updated Helmer to TUTOR role and name.');
        } else if (p.role !== 'TUTOR') {
            console.log('Name is OK but role is not TUTOR. Fixing role...');
            await supabase.rpc('exec_sql', {
                p_sql: `UPDATE profiles SET role = 'TUTOR' WHERE id = '${p.id}'`
            });
            console.log('Role updated to TUTOR.');
        }
    }
}

run();
