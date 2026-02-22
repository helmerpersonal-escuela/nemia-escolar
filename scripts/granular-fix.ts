import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function runSQL(sql: string, label: string) {
    console.log(`--- ${label} ---`);
    const { data, error } = await supabase.rpc('exec_query', { p_sql: `SELECT * FROM (${sql}) t` });
    if (error) {
        console.error(`${label} ERROR:`, error);
        return false;
    }
    console.log(`${label} OK. Result:`, JSON.stringify(data, null, 2));
    return true;
}

async function run() {
    const helmerId = '85870a47-4730-401d-a96c-a3712e821b3d';
    const studentId = '8c0a8767-1601-4993-96b6-58673f808381';
    const tenantId = 'c8b671a5-8fe1-4770-985f-8255e2a22f30';

    console.log('--- STARTING GRANULAR FIX ---');

    // 1. Profiles
    await runSQL(`
        UPDATE profiles 
        SET 
            role = 'TUTOR',
            first_name = 'HELMER',
            full_name = 'HELMER FERRAS COUTIÑO',
            last_name_paternal = 'FERRAS',
            last_name_maternal = 'COUTIÑO',
            tenant_id = '${tenantId}'
        WHERE id = '${helmerId}'
        RETURNING role, full_name
    `, 'UPDATE PROFILE');

    // 2. Profile Tenants
    await runSQL(`
        INSERT INTO profile_tenants (profile_id, tenant_id, role, first_name, last_name_paternal, last_name_maternal, full_name)
        VALUES ('${helmerId}', '${tenantId}', 'TUTOR', 'HELMER', 'FERRAS', 'COUTIÑO', 'HELMER FERRAS COUTIÑO')
        ON CONFLICT (profile_id, tenant_id) DO UPDATE SET 
            role = 'TUTOR', 
            first_name = 'HELMER',
            last_name_paternal = 'FERRAS',
            last_name_maternal = 'COUTIÑO',
            full_name = 'HELMER FERRAS COUTIÑO'
        RETURNING role
    `, 'UPSERT PROFILE_TENANTS');

    // 3. Guardians (Correcting columns)
    await runSQL(`
        INSERT INTO guardians (user_id, profile_id, student_id, relationship, tenant_id, first_name, last_name_paternal, last_name_maternal)
        VALUES ('${helmerId}', '${helmerId}', '${studentId}', 'Padre', '${tenantId}', 'HELMER', 'FERRAS', 'COUTIÑO')
        ON CONFLICT (user_id, student_id) DO UPDATE SET 
            relationship = 'Padre',
            tenant_id = '${tenantId}'
        RETURNING relationship
    `, 'UPSERT GUARDIANS');

    // 4. Student
    await runSQL(`
        UPDATE students 
        SET 
            sex = 'HOMBRE',
            avatar_url = 'https://api.dicebear.com/7.x/avataaars/svg?seed=HelmerStudent&gender=male'
        WHERE id = '${studentId}'
        RETURNING sex
    `, 'UPDATE STUDENT');

    console.log('--- GRANULAR FIX COMPLETED ---');
}

run();
