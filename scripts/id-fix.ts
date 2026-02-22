import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    const id = '85870a47-4730-401d-a96c-a3712e821b3d';
    const email = 'helmerferras@gmail.com';

    console.log(`--- ID FIX for ${id} ---`);

    const sql = `
        WITH update_p AS (
            UPDATE profiles 
            SET first_name = 'HELMER', full_name = 'HELMER FERRAS COUTIÑO', role = 'TUTOR'
            WHERE id = '${id}'
            RETURNING *
        )
        SELECT * FROM update_p
    `;

    const { data, error } = await supabase.rpc('exec_query', { p_sql: sql });

    if (error) {
        console.error('ERROR:', error);
    } else {
        console.log('UPDATE RESULT:', JSON.stringify(data, null, 2));
    }

    const { data: final } = await supabase.rpc('exec_query', { p_sql: `SELECT * FROM profiles WHERE id = '${id}'` });
    console.log('FINAL STATE:', JSON.stringify(final, null, 2));
}

run();
