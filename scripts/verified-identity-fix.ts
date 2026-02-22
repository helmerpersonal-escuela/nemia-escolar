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
    // Verified IDs from screenshot
    const danielaId = '85870a47-4730-401d-a96c-a3712e821b3d';
    const helmerTutorId = 'ecd127be-a39c-48a9-8661-e50ffb2248fd';
    const superAdminId = 'de9db367-3154-4fdf-a625-f924946cef2e';
    const tenantId = 'c8b671a5-8fe1-4770-985f-8255e2a22f30';

    console.log('--- DEFINITIVE IDENTITY FIX ---');

    await runSQL('ALTER TABLE profiles DISABLE TRIGGER ALL', 'DISABLE TRIGGERS');

    // 1. Reset Daniela
    await runSQL(`
        UPDATE profiles 
        SET 
            first_name = 'DANIELA',
            full_name = 'DANIELA HERNANDEZ',
            role = 'TEACHER',
            tenant_id = '${tenantId}'
        WHERE id = '${danielaId}'
    `, 'RESET DANIELA');

    // 2. Reset Helmer Tutor
    await runSQL(`
        UPDATE profiles 
        SET 
            first_name = 'HELMER',
            full_name = 'HELMER FERRAS COUTIÑO',
            role = 'TUTOR',
            tenant_id = '${tenantId}'
        WHERE id = '${helmerTutorId}'
    `, 'RESET HELMER TUTOR');

    // 3. Sync Auth Metadata
    await runSQL(`
        UPDATE auth.users 
        SET raw_user_meta_data = raw_user_meta_data || '{"firstName":"HELMER"}'::jsonb 
        WHERE email = 'helmerferras@gmail.com'
    `, 'SYNC HELMER AUTH METADATA');

    await runSQL(`
        UPDATE auth.users 
        SET raw_user_meta_data = raw_user_meta_data || '{"firstName":"DANIELA"}'::jsonb 
        WHERE email = 'damahel2017@gmail.com'
    `, 'SYNC DANIELA AUTH METADATA');

    await runSQL('ALTER TABLE profiles ENABLE TRIGGER ALL', 'ENABLE TRIGGERS');

    console.log('--- VERIFYING ---');
    const { data } = await supabase.from('profiles').select('id, email, first_name, role').in('id', [danielaId, helmerTutorId, superAdminId]);
    console.log(JSON.stringify(data, null, 2));

    console.log('--- COMPLETE ---');
}

run();
