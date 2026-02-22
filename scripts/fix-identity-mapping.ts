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
    // Correct IDs from screenshot
    const danielaId = '85870a47-4730-401d-a96c-a3712e821b3d';
    const helmerTutorId = 'ecd127be-a39c-48a9-8661-e50ffb2248fd';
    const superAdminId = 'de9db367-3154-4fdf-a625-f924946cef2e';

    const tenantId = 'c8b671a5-8fe1-4770-985f-8255e2a22f30'; // Secundaria Técnica
    const studentId = '8c0a8767-1601-4993-96b6-58673f808381';

    console.log('--- CORRECTING IDENTITY MAPPING ---');

    // 1. Disable triggers
    await runSQL('ALTER TABLE profiles DISABLE TRIGGER ALL', 'DISABLE TRIGGERS');

    // 2. Fix Helmer Tutor (helmerferras@gmail.com)
    await runSQL(`
        UPDATE profiles 
        SET 
            email = 'helmerferras@gmail.com',
            first_name = 'HELMER',
            full_name = 'HELMER FERRAS COUTIÑO',
            last_name_paternal = 'FERRAS',
            last_name_maternal = 'COUTIÑO',
            role = 'TUTOR',
            tenant_id = '${tenantId}'
        WHERE id = '${helmerTutorId}'
    `, 'FIX HELMER TUTOR PROFILE');

    // 3. Fix Daniela (damahel2017@gmail.com)
    await runSQL(`
        UPDATE profiles 
        SET 
            email = 'damahel2017@gmail.com',
            first_name = 'DANIELA',
            full_name = 'DANIELA HERNANDEZ',
            last_name_paternal = 'HERNANDEZ',
            role = 'TEACHER',
            tenant_id = '${tenantId}'
        WHERE id = '${danielaId}'
    `, 'FIX DANIELA PROFILE');

    // 4. Fix SuperAdmin (helmerpersonal@gmail.com)
    await runSQL(`
        UPDATE profiles 
        SET 
            email = 'helmerpersonal@gmail.com',
            first_name = 'HELMER',
            full_name = 'HELMER PERSONAL (GOD)',
            role = 'SUPER_ADMIN',
            tenant_id = NULL
        WHERE id = '${superAdminId}'
    `, 'FIX SUPERADMIN PROFILE');

    // 5. Fix Links for Helmer Tutor
    await runSQL(`DELETE FROM profile_tenants WHERE profile_id = '${helmerTutorId}'`, 'CLEAN PT HELMER');
    await runSQL(`
        INSERT INTO profile_tenants (profile_id, tenant_id, role, first_name, last_name_paternal, full_name)
        VALUES ('${helmerTutorId}', '${tenantId}', 'TUTOR', 'HELMER', 'FERRAS', 'HELMER FERRAS COUTIÑO')
    `, 'LINK HELMER TUTOR TENANT');

    await runSQL(`DELETE FROM guardians WHERE user_id = '${helmerTutorId}'`, 'CLEAN GUARDIAN HELMER');
    await runSQL(`
        INSERT INTO guardians (user_id, profile_id, student_id, relationship, tenant_id, first_name, last_name_paternal)
        VALUES ('${helmerTutorId}', '${helmerTutorId}', '${studentId}', 'Padre', '${tenantId}', 'HELMER', 'FERRAS')
    `, 'LINK HELMER TUTOR STUDENT');

    // 6. Enable triggers
    await runSQL('ALTER TABLE profiles ENABLE TRIGGER ALL', 'ENABLE TRIGGERS');

    console.log('--- DATABASE FIX COMPLETED ---');
}

run();
