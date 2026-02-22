import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function runSQL(sql: string, label: string) {
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
    if (error) {
        console.error(`${label} ERROR:`, error.message);
        return false;
    }
    console.log(`${label} OK.`);
    return true;
}

async function run() {
    const danielaId = '85870a47-4730-401d-a96c-a3712e821b3d';
    const helmerTutorId = 'ecd127be-a39c-48a9-8661-e50ffb2248fd';

    console.log('--- PARTIAL IDENTITY RESET (NO TENANT_ID) ---');

    await runSQL('ALTER TABLE profiles DISABLE TRIGGER ALL', 'DISABLE TRIGGERS');

    // 1. Reset Daniela
    await runSQL(`
        UPDATE profiles 
        SET 
            first_name = 'DANIELA',
            full_name = 'DANIELA HERNANDEZ',
            last_name_paternal = 'HERNANDEZ',
            role = 'TEACHER'
        WHERE id = '${danielaId}'
    `, 'RESET DANIELA');

    // 2. Reset Helmer Tutor
    await runSQL(`
        UPDATE profiles 
        SET 
            first_name = 'HELMER',
            full_name = 'HELMER FERRAS COUTIÑO',
            last_name_paternal = 'FERRAS',
            last_name_maternal = 'COUTIÑO',
            role = 'TUTOR'
        WHERE id = '${helmerTutorId}'
    `, 'RESET HELMER TUTOR');

    await runSQL('ALTER TABLE profiles ENABLE TRIGGER ALL', 'ENABLE TRIGGERS');

    console.log('--- PARTIAL RESET COMPLETED ---');
}

run();
