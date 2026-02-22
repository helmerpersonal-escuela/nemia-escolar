import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    console.log('Finding profiles for damahel2017@gmail.com...');
    const { data: danielaProfiles } = await supabase.rpc('exec_query', {
        p_sql: "SELECT id, email, first_name, role, tenant_id FROM profiles WHERE email = 'damahel2017@gmail.com'"
    });
    console.log('DANIELA PROFILES:', JSON.stringify(danielaProfiles, null, 2));

    console.log('Finding profiles for helmerferras@gmail.com...');
    const { data: helmerProfiles } = await supabase.rpc('exec_query', {
        p_sql: "SELECT id, email, first_name, role, tenant_id FROM profiles WHERE email = 'helmerferras@gmail.com'"
    });
    console.log('HELMER PROFILES:', JSON.stringify(helmerProfiles, null, 2));

    const tenantId = 'c8b671a5-8fe1-4770-985f-8255e2a22f30';
    const studentId = '8c0a8767-1601-4993-96b6-58673f808381';

    console.log('--- DEFINITIVE DUPLICATE FIX ---');

    if (helmerProfiles) {
        for (const p of helmerProfiles) {
            console.log(`Fixing profile ID: ${p.id}`);
            const sql = `
                WITH u AS (
                    UPDATE profiles 
                    SET 
                        first_name = 'HELMER',
                        full_name = 'HELMER FERRAS COUTIÑO',
                        role = 'TUTOR',
                        tenant_id = '${tenantId}'
                    WHERE id = '${p.id}'
                    RETURNING id
                )
                SELECT * FROM u
            `;
            const { error } = await supabase.rpc('exec_query', { p_sql: sql });
            if (error) console.error(`Error fixing ${p.id}:`, error);
            else {
                console.log(`Profile ${p.id} updated.`);

                // Link to student/tenant
                await supabase.rpc('exec_query', {
                    p_sql: `
                        INSERT INTO profile_tenants (profile_id, tenant_id, role, first_name, last_name_paternal, full_name)
                        VALUES ('${p.id}', '${tenantId}', 'TUTOR', 'HELMER', 'FERRAS', 'HELMER FERRAS COUTIÑO')
                        ON CONFLICT (profile_id, tenant_id) DO UPDATE SET role = 'TUTOR'
                    `
                });

                await supabase.rpc('exec_query', {
                    p_sql: `
                        INSERT INTO guardians (user_id, profile_id, student_id, relationship, tenant_id, first_name, last_name_paternal)
                        VALUES ('${p.id}', '${p.id}', '${studentId}', 'Padre', '${tenantId}', 'HELMER', 'FERRAS')
                        ON CONFLICT (user_id, student_id) DO UPDATE SET relationship = 'Padre', tenant_id = '${tenantId}'
                    `
                });
            }
        }
    }

    console.log('Verifying result...');
    const { data: final } = await supabase.rpc('exec_query', {
        p_sql: "SELECT id, email, first_name, role FROM profiles WHERE email = 'helmerferras@gmail.com'"
    });
    console.log('FINAL STATE:', JSON.stringify(final, null, 2));
}

run();
