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
    // Verified IDs
    const helmerTutorId = 'ecd127be-a39c-48a9-8661-e50ffb2248fd';
    const danielaId = '85870a47-4730-401d-a96c-a3712e821b3d';
    const tenantId = 'c8b671a5-8fe1-4770-985f-8255e2a22f30'; // SECUNDARIA TECNICA NO 37
    const studentId = '8c0a8767-1601-4993-96b6-58673f808381';

    console.log('--- DEFINITIVE DATA LINKING ---');

    // 1. Ensure Profile Roles in `profiles` table
    await runSQL(`UPDATE profiles SET role = 'TUTOR', tenant_id = '${tenantId}', first_name = 'HELMER' WHERE id = '${helmerTutorId}'`, 'UPDATE HELMER PROFILE');
    await runSQL(`UPDATE profiles SET role = 'TEACHER', tenant_id = '${tenantId}', first_name = 'DANIELA' WHERE id = '${danielaId}'`, 'UPDATE DANIELA PROFILE');

    // 2. Link Helmer to Workspace as TUTOR
    await runSQL(`
        INSERT INTO profile_tenants (profile_id, tenant_id, role, first_name, full_name, last_name_paternal)
        VALUES (
            '${helmerTutorId}', 
            '${tenantId}', 
            'TUTOR', 
            'HELMER', 
            'HELMER FERRAS COUTIÑO', 
            'FERRAS'
        )
        ON CONFLICT (profile_id, tenant_id) DO UPDATE 
        SET role = 'TUTOR', first_name = 'HELMER', full_name = 'HELMER FERRAS COUTIÑO', last_name_paternal = 'FERRAS';
    `, 'LINK HELMER TO TENANT AS TUTOR');

    // 3. Link Helmer to Student as GUARDIAN
    await runSQL(`
        INSERT INTO guardians (user_id, profile_id, student_id, relationship, tenant_id, first_name, last_name_paternal, email)
        VALUES (
            '${helmerTutorId}', 
            '${helmerTutorId}', 
            '${studentId}', 
            'Padre', 
            '${tenantId}', 
            'HELMER', 
            'FERRAS',
            'helmerferras@gmail.com'
        )
        ON CONFLICT (user_id, student_id) DO UPDATE 
        SET relationship = 'Padre', tenant_id = '${tenantId}', first_name = 'HELMER', last_name_paternal = 'FERRAS';
    `, 'LINK HELMER TO STUDENT AS GUARDIAN');

    // 4. Ensure Daniela is linked as TEACHER to the school
    await runSQL(`
        INSERT INTO profile_tenants (profile_id, tenant_id, role, first_name, full_name, last_name_paternal)
        VALUES (
            '${danielaId}', 
            '${tenantId}', 
            'TEACHER', 
            'DANIELA', 
            'DANIELA HERNANDEZ', 
            'HERNANDEZ'
        )
        ON CONFLICT (profile_id, tenant_id) DO UPDATE 
        SET role = 'TEACHER', first_name = 'DANIELA', full_name = 'DANIELA HERNANDEZ', last_name_paternal = 'HERNANDEZ';
    `, 'LINK DANIELA TO TENANT AS TEACHER');

    console.log('--- DATA LINKING COMPLETE ---');
}

run();
