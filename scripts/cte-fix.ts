import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    const email = 'helmerferras@gmail.com';
    const tenantId = 'c8b671a5-8fe1-4770-985f-8255e2a22f30';
    console.log('--- CTE FIX ---');

    const sql = `
        WITH u AS (
            UPDATE profiles 
            SET 
                first_name = 'HELMER',
                full_name = 'HELMER FERRAS COUTIÑO',
                last_name_paternal = 'FERRAS',
                last_name_maternal = 'COUTIÑO',
                role = 'TUTOR',
                tenant_id = '${tenantId}'
            WHERE email = '${email}'
            RETURNING id
        )
        SELECT * FROM u
    `;

    const { data, error } = await supabase.rpc('exec_query', { p_sql: sql });

    if (error) {
        console.error('ERROR:', error);
    } else {
        console.log('RESULT:', JSON.stringify(data, null, 2));
    }

    // Check State
    const { data: check } = await supabase.rpc('exec_query', { p_sql: `SELECT id, first_name, role FROM profiles WHERE email = '${email}'` });
    console.log('NEW STATE:', JSON.stringify(check));
}

run();
