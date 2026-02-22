import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    console.log('--- RE-CONFIRMING IDENTITY ---');
    const sql = "SELECT id, email, first_name, last_name_paternal, role FROM profiles ORDER BY created_at DESC LIMIT 50;";
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
        console.error('Error running exec_sql:', error);
        return;
    }

    console.log('Found', data?.length || 0, 'profiles.');

    const helmerByEmail = data?.find((p: any) => p.email?.toLowerCase().includes('helmer'));
    const helmerByName = data?.find((p: any) => p.first_name?.toLowerCase().includes('helmer'));

    if (helmerByEmail || helmerByName) {
        console.log('HELMER FOUND:');
        console.log(helmerByEmail || helmerByName);
    } else {
        console.log('Helmer not found in the last 50 profiles.');
        console.log('Full list for inspection:');
        console.table(data);
    }
}

run();
