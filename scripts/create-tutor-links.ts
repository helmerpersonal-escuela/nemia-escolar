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
    console.log(`${label} OK`);
    return true;
}

async function run() {
    // VERIFIED IDs from db-dump.json
    const helmerTutorId = 'ecd127be-a39c-48a9-8661-e50ffb2248fd';
    const studentId = 'a0f1f865-6389-4da9-b451-b968eb1b3717';
    const tenantId = 'efc61ce1-32c2-47b6-9751-95becd7ddc33';

    console.log('--- CREATING TUTOR LINKS WITH VERIFIED IDs ---');

    // 1. Update profile to use correct tenant
    await runSQL(`
        UPDATE profiles 
        SET role = 'TUTOR', tenant_id = '${tenantId}'
        WHERE id = '${helmerTutorId}'
    `, 'UPDATE PROFILE TENANT');

    // 2. Create profile_tenants entry (using exec_sql to bypass RLS)
    await runSQL(`
        INSERT INTO profile_tenants (profile_id, tenant_id, role, first_name, last_name_paternal, full_name)
        VALUES (
            '${helmerTutorId}', 
            '${tenantId}', 
            'TUTOR', 
            'HELMER', 
            'FERRAS',
            'HELMER FERRAS COUTIÑO'
        )
        ON CONFLICT (profile_id, tenant_id, role) DO UPDATE 
        SET first_name = 'HELMER', full_name = 'HELMER FERRAS COUTIÑO'
    `, 'CREATE PROFILE_TENANTS');

    // 3. Create guardians entry
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
        SET relationship = 'Padre', tenant_id = '${tenantId}'
    `, 'CREATE GUARDIAN');

    // 4. Verify
    console.log('\n--- VERIFICATION ---');
    const { data: pt } = await supabase.rpc('exec_query', {
        p_sql: `SELECT profile_id, tenant_id, role FROM profile_tenants WHERE profile_id = '${helmerTutorId}'`
    });
    console.log('profile_tenants:', JSON.stringify(pt, null, 2));

    const { data: g } = await supabase.rpc('exec_query', {
        p_sql: `SELECT user_id, student_id, relationship FROM guardians WHERE user_id = '${helmerTutorId}'`
    });
    console.log('guardians:', JSON.stringify(g, null, 2));

    const { data: profile } = await supabase.rpc('exec_query', {
        p_sql: `SELECT id, first_name, role, tenant_id FROM profiles WHERE id = '${helmerTutorId}'`
    });
    console.log('profile:', JSON.stringify(profile, null, 2));

    console.log('\n--- DONE ---');
}

run();
