import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function runSQL(sql: string, label: string) {
    console.log(`--- ${label} ---`);
    const { data, error } = await supabase.rpc('exec_query', { p_sql: sql });
    if (error) {
        console.error(`${label} ERROR:`, error);
    } else {
        console.log(`${label} OK.`);
    }
}

async function run() {
    const email = 'helmerferras@gmail.com';
    const tenantId = 'c8b671a5-8fe1-4770-985f-8255e2a22f30';
    const studentId = '8c0a8767-1601-4993-96b6-58673f808381';

    console.log('--- RESOLVING DUPLICATE PROFILES ---');

    // 1. Update ALL profiles with this email
    await runSQL(`
        UPDATE profiles 
        SET 
            first_name = 'HELMER', 
            full_name = 'HELMER FERRAS COUTIÑO', 
            role = 'TUTOR',
            tenant_id = '${tenantId}'
        WHERE email = '${email}'
    `, 'UPDATE ALL PROFILES');

    // 2. Identify all IDs for this email
    const { data: ids } = await supabase.rpc('exec_query', {
        p_sql: `SELECT id FROM profiles WHERE email = '${email}'`
    });

    if (ids) {
        for (const row of ids) {
            const id = row.id;
            console.log(`Processing ID: ${id}`);

            // 3. Upsert profile_tenants for each ID
            await runSQL(`
                INSERT INTO profile_tenants (profile_id, tenant_id, role, first_name, last_name_paternal, last_name_maternal, full_name)
                VALUES ('${id}', '${tenantId}', 'TUTOR', 'HELMER', 'FERRAS', 'COUTIÑO', 'HELMER FERRAS COUTIÑO')
                ON CONFLICT DO NOTHING
            `, `PT FOR ${id}`);

            // 4. Link to student for each ID
            await runSQL(`
                INSERT INTO guardians (user_id, profile_id, student_id, relationship, tenant_id, first_name, last_name_paternal, last_name_maternal)
                VALUES ('${id}', '${id}', '${studentId}', 'Padre', '${tenantId}', 'HELMER', 'FERRAS', 'COUTIÑO')
                ON CONFLICT (user_id, student_id) DO NOTHING
            `, `GUARDIAN FOR ${id}`);
        }
    }

    console.log('--- DUPLICATE RESOLUTION COMPLETED ---');
}

run();
