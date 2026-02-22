import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    const ids = ['ecd127be-a39c-47b6-9751-95becd7ddc33', '85870a47-4730-401d-a96c-a3712e821b3d'];
    const tenantId = 'c8b671a5-8fe1-4770-985f-8255e2a22f30';
    console.log('--- FINAL ID-BY-ID FIX ---');

    for (const id of ids) {
        console.log(`Working on ID: ${id}`);
        const sql = `UPDATE profiles SET first_name = 'HELMER', full_name = 'HELMER FERRAS COUTIÑO', role = 'TUTOR', tenant_id = '${tenantId}' WHERE id = '${id}' RETURNING first_name, role`;
        const { data, error } = await supabase.rpc('exec_query', { p_sql: sql });
        if (error) console.error(`Error for ${id}:`, error);
        else console.log(`Result for ${id}:`, JSON.stringify(data));
    }

    console.log('--- VERIFYING ---');
    const { data: final } = await supabase.rpc('exec_query', { p_sql: "SELECT id, email, first_name, role FROM profiles WHERE email = 'helmerferras@gmail.com'" });
    console.log(JSON.stringify(final, null, 2));
}

run();
