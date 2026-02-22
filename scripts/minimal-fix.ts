import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    const id = '85870a47-4730-401d-a96c-a3712e821b3d';
    console.log('--- MINIMAL FIX ---');

    // Attempt 1: Just update first_name
    await supabase.rpc('exec_query', { p_sql: `UPDATE profiles SET first_name = 'HELMER' WHERE id = '${id}'` });
    console.log('Update first_name attempted.');

    // Attempt 2: Update role
    await supabase.rpc('exec_query', { p_sql: `UPDATE profiles SET role = 'TUTOR' WHERE id = '${id}'` });
    console.log('Update role attempted.');

    // Verify
    const { data } = await supabase.rpc('exec_query', { p_sql: `SELECT first_name, role FROM profiles WHERE id = '${id}'` });
    console.log('CURRENT STATE:', JSON.stringify(data));
}

run();
