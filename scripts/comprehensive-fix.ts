import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    const helmerId = '85870a47-4730-401d-a96c-a3712e821b3d';
    const studentId = '8c0a8767-1601-4993-96b6-58673f808381';
    const tenantId = 'c8b671a5-8fe1-4770-985f-8255e2a22f30';

    console.log('--- STARTING COMPREHENSIVE FIX ---');

    // 1. Update Profile
    const updateProfileSql = `
        UPDATE profiles 
        SET 
            role = 'TUTOR',
            first_name = 'HELMER',
            full_name = 'HELMER FERRAS COUTIÑO',
            last_name_paternal = 'FERRAS',
            last_name_maternal = 'COUTIÑO',
            tenant_id = '${tenantId}'
        WHERE id = '${helmerId}'
        RETURNING role, full_name, tenant_id
    `;
    const { data: pRes, error: pError } = await supabase.rpc('exec_query', { p_sql: `SELECT * FROM (${updateProfileSql}) t` });
    if (pError) console.error('P ERROR:', pError);
    else console.log('P UPDATED:', JSON.stringify(pRes, null, 2));

    // 2. Upsert profile_tenants
    const upsertPTSql = `
        INSERT INTO profile_tenants (profile_id, tenant_id, role, first_name, last_name_paternal, last_name_maternal, full_name)
        VALUES ('${helmerId}', '${tenantId}', 'TUTOR', 'HELMER', 'FERRAS', 'COUTIÑO', 'HELMER FERRAS COUTIÑO')
        ON CONFLICT (profile_id, tenant_id) DO UPDATE SET 
            role = 'TUTOR', 
            first_name = 'HELMER',
            last_name_paternal = 'FERRAS',
            last_name_maternal = 'COUTIÑO',
            full_name = 'HELMER FERRAS COUTIÑO'
        RETURNING role, tenant_id
    `;
    const { data: ptRes, error: ptError } = await supabase.rpc('exec_query', { p_sql: `SELECT * FROM (${upsertPTSql}) t` });
    if (ptError) console.error('PT ERROR:', ptError);
    else console.log('PT UPDATED:', JSON.stringify(ptRes, null, 2));

    // 3. Upsert Guardians
    const upsertGSql = `
        INSERT INTO guardians (user_id, student_id, relationship, tenant_id, first_name, last_name_paternal, last_name_maternal)
        VALUES ('${helmerId}', '${studentId}', 'Padre', '${tenantId}', 'HELMER', 'FERRAS', 'COUTIÑO')
        ON CONFLICT (user_id, student_id) DO UPDATE SET 
            relationship = 'Padre',
            tenant_id = '${tenantId}'
        RETURNING relationship, student_id
    `;
    const { data: gRes, error: gError } = await supabase.rpc('exec_query', { p_sql: `SELECT * FROM (${upsertGSql}) t` });
    if (gError) console.error('G ERROR:', gError);
    else console.log('G UPDATED:', JSON.stringify(gRes, null, 2));

    // 4. Fix Student Avatar (Ensure it's a boy)
    const updateSSql = `
        UPDATE students 
        SET 
            sex = 'HOMBRE',
            avatar_url = 'https://api.dicebear.com/7.x/avataaars/svg?seed=HelmerStudent&gender=male'
        WHERE id = '${studentId}'
        RETURNING sex, avatar_url
    `;
    const { data: sRes, error: sError } = await supabase.rpc('exec_query', { p_sql: `SELECT * FROM (${updateSSql}) t` });
    if (sError) console.error('S ERROR:', sError);
    else console.log('S UPDATED:', JSON.stringify(sRes, null, 2));

    console.log('--- FIX COMPLETED ---');
}

run();
