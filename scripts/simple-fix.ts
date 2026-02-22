import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    console.log('--- SIMPLE FIX ---');
    const email = 'helmerferras@gmail.com';

    // Explicitly update only essential fields to avoid trigger issues if possible
    const sql = `
        UPDATE profiles 
        SET 
            first_name = 'HELMER',
            full_name = 'HELMER FERRAS COUTIÑO',
            role = 'TUTOR'
        WHERE email = '${email}'
        RETURNING id, role, first_name
    `;

    const { data, error } = await supabase.rpc('exec_query', { p_sql: `SELECT * FROM (${sql}) t` });

    if (error) {
        console.error('ERROR:', error);
    } else {
        console.log('RESULT:', JSON.stringify(data, null, 2));
    }
}

run();
