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
    const email = 'helmerferras@gmail.com';
    const tenantId = 'c8b671a5-8fe1-4770-985f-8255e2a22f30';
    const studentId = '8c0a8767-1601-4993-96b6-58673f808381';

    console.log('--- STARTING NUCLEAR PROFILE RESTORATION ---');

    // 1. Disable Triggers
    const disableTriggers = `
        ALTER TABLE profiles DISABLE TRIGGER tr_audit_profiles;
        ALTER TABLE profiles DISABLE TRIGGER IF EXISTS on_profile_update_audit_log;
    `;
    if (!await runSQL(disableTriggers, 'DISABLE TRIGGERS')) {
        console.log('Falling back to individual trigger disables...');
        await runSQL('ALTER TABLE profiles DISABLE TRIGGER tr_audit_profiles', 'DISABLE tr_audit_profiles');
    }

    // 2. Update Profiles (All duplicates)
    const updateProfiles = `
        UPDATE profiles 
        SET 
            first_name = 'HELMER',
            full_name = 'HELMER FERRAS COUTIÑO',
            last_name_paternal = 'FERRAS',
            last_name_maternal = 'COUTIÑO',
            role = 'TUTOR',
            tenant_id = '${tenantId}'
        WHERE email = '${email}';
    `;
    await runSQL(updateProfiles, 'UPDATE PROFILES');

    // 3. Ensure Links
    // Get all IDs first to be safe
    const { data: profiles } = await supabase.rpc('exec_query', {
        p_sql: `SELECT id FROM profiles WHERE email = '${email}'`
    });

    if (profiles) {
        for (const p of profiles) {
            console.log(`Linking ID ${p.id} to tenant and student...`);

            const ptLink = `
                INSERT INTO profile_tenants (profile_id, tenant_id, role, first_name, last_name_paternal, full_name)
                VALUES ('${p.id}', '${tenantId}', 'TUTOR', 'HELMER', 'FERRAS', 'HELMER FERRAS COUTIÑO')
                ON CONFLICT (profile_id, tenant_id) DO UPDATE SET role = 'TUTOR', first_name = 'HELMER', full_name = 'HELMER FERRAS COUTIÑO';
            `;
            await runSQL(ptLink, `PT LINK FOR ${p.id}`);

            const gLink = `
                INSERT INTO guardians (user_id, profile_id, student_id, relationship, tenant_id, first_name, last_name_paternal)
                VALUES ('${p.id}', '${p.id}', '${studentId}', 'Padre', '${tenantId}', 'HELMER', 'FERRAS')
                ON CONFLICT (user_id, student_id) DO UPDATE SET relationship = 'Padre', tenant_id = '${tenantId}';
            `;
            await runSQL(gLink, `GUARDIAN LINK FOR ${p.id}`);
        }
    }

    // 4. Update Student
    const updateStudent = `
        UPDATE students 
        SET sex = 'HOMBRE', avatar_url = 'https://api.dicebear.com/7.x/avataaars/svg?seed=HelmerStudent&gender=male'
        WHERE id = '${studentId}';
    `;
    await runSQL(updateStudent, 'UPDATE STUDENT DATA');

    // 5. Re-enable Triggers
    const enableTriggers = `
        ALTER TABLE profiles ENABLE TRIGGER tr_audit_profiles;
        ALTER TABLE profiles ENABLE TRIGGER IF EXISTS on_profile_update_audit_log;
    `;
    await runSQL(enableTriggers, 'RE-ENABLE TRIGGERS');

    console.log('--- NUCLEAR RESTORATION COMPLETE ---');
}

run();
