import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function runSQL(sql: string, label: string) {
    console.log(`--- ${label} ---`);
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    if (error) {
        console.error(`${label} ERROR:`, error.message);
        return false;
    }
    console.log(`${label} OK.`);
    return true;
}

async function run() {
    // Verified IDs from screenshot
    const danielaId = '85870a47-4730-401d-a96c-a3712e821b3d';
    const helmerTutorId = 'ecd127be-a39c-48a9-8661-e50ffb2248fd';
    const superAdminId = 'de9db367-3154-4fdf-a625-f924946cef2e';

    const tenantIdProfile = 'efc61ce1-ef80-496a-8f69-7685601fc99d'; // SECUNDARIA TECNICA NO 37
    const tenantIdFixed = 'c8b671a5-8fe1-4770-985f-8255e2a22f30'; // Actual ID from DB check

    console.log('--- PERFORMING FINAL IDENTITY RESET ---');

    await runSQL('ALTER TABLE profiles DISABLE TRIGGER ALL', 'DISABLE TRIGGERS');

    // 1. Fix Daniela (damahel2017@gmail.com)
    await runSQL(`
        UPDATE profiles 
        SET 
            first_name = 'DANIELA',
            full_name = 'DANIELA HERNANDEZ',
            last_name_paternal = 'HERNANDEZ',
            role = 'TEACHER',
            tenant_id = '${tenantIdFixed}'
        WHERE id = '${danielaId}'
    `, 'RESET DANIELA PROFILE');

    // 2. Fix Helmer Tutor (helmerferras@gmail.com)
    await runSQL(`
        UPDATE profiles 
        SET 
            first_name = 'HELMER',
            full_name = 'HELMER FERRAS COUTIÑO',
            last_name_paternal = 'FERRAS',
            last_name_maternal = 'COUTIÑO',
            role = 'TUTOR',
            tenant_id = '${tenantIdFixed}'
        WHERE id = '${helmerTutorId}'
    `, 'RESET HELMER TUTOR PROFILE');

    // 3. Fix SuperAdmin (helmerpersonal@gmail.com)
    await runSQL(`
        UPDATE profiles 
        SET 
            role = 'SUPER_ADMIN',
            tenant_id = NULL
        WHERE id = '${superAdminId}'
    `, 'RESET SUPERADMIN');

    await runSQL('ALTER TABLE profiles ENABLE TRIGGER ALL', 'ENABLE TRIGGERS');

    console.log('--- IDENTITY RESET COMPLETED ---');
}

run();
