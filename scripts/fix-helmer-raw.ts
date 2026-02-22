import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    const email = 'helmerferras@gmail.com';
    const helmerId = '85870a47-4730-401d-a96c-a3712e821b3d';
    const studentId = '8c0a8767-1601-4993-96b6-58673f808381';
    const tenantId = 'c8b671a5-8fe1-4770-985f-8255e2a22f30';

    console.log('--- ATTEMPTING RAW SQL UPDATE ---');

    // We use SELECT ... FROM (UPDATE ...) as a trick to use exec_query for writes
    const updateSql = `
        WITH updated_profile AS (
            UPDATE profiles 
            SET 
                role = 'TUTOR',
                first_name = 'HELMER',
                full_name = 'HELMER FERRAS COUTIÑO',
                last_name_paternal = 'FERRAS',
                last_name_maternal = 'COUTIÑO',
                tenant_id = '${tenantId}'
            WHERE id = '${helmerId}'
            RETURNING *
        )
        SELECT * FROM updated_profile
    `;

    const { data: pRes, error: pError } = await supabase.rpc('exec_query', { p_sql: updateSql });
    if (pError) console.error('Profile Update Error:', pError);
    else console.log('Profile Updated:', JSON.stringify(pRes, null, 2));

    // Update Student as well (just in case)
    const updateStudentSql = `
        WITH updated_student AS (
            UPDATE students 
            SET 
                sex = 'HOMBRE',
                avatar_url = 'https://api.dicebear.com/7.x/avataaars/svg?seed=HelmerStudent&gender=male'
            WHERE id = '${studentId}'
            RETURNING *
        )
        SELECT * FROM updated_student
    `;
    const { data: sRes, error: sError } = await supabase.rpc('exec_query', { p_sql: updateStudentSql });
    if (sError) console.error('Student Update Error:', sError);
    else console.log('Student Updated:', JSON.stringify(sRes, null, 2));

    // Fix Guardian link
    const fixGuardianSql = `
        INSERT INTO guardians (user_id, student_id, relationship, is_emergency_contact)
        VALUES ('${helmerId}', '${studentId}', 'Padre', true)
        ON CONFLICT (user_id, student_id) DO UPDATE SET relationship = 'Padre'
        RETURNING *
    `;
    const { data: gRes, error: gError } = await supabase.rpc('exec_query', { p_sql: `SELECT * FROM (${fixGuardianSql}) t` });
    if (gError) console.error('Guardian Fix Error:', gError);
    else console.log('Guardian Fixed:', JSON.stringify(gRes, null, 2));
}

run();
