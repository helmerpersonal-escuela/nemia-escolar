import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    const helmerTutorId = 'ecd127be-a39c-48a9-8661-e50ffb2248fd';
    const tenantId = 'efc61ce1-32c2-47b6-9751-95becd7ddc33'; // SCHOOL type

    console.log('--- INSERTING PROFILE_TENANTS WITH MINIMAL REQUIRED FIELDS ---');

    // The schema shows only 3 NOT NULL columns: profile_id, tenant_id, role
    // Previous inserts included optional fields that might have caused issues

    // First delete any existing records for this user
    const { error: deleteError } = await supabase.rpc('exec_sql', {
        sql_query: `DELETE FROM profile_tenants WHERE profile_id = '${helmerTutorId}'`
    });
    if (deleteError) console.log('DELETE (may fail if none exist):', deleteError.message);
    else console.log('DELETE OK');

    // Insert with only required fields
    const { error: insertError } = await supabase.rpc('exec_sql', {
        sql_query: `INSERT INTO profile_tenants (profile_id, tenant_id, role) VALUES ('${helmerTutorId}', '${tenantId}', 'TUTOR')`
    });
    if (insertError) {
        console.error('INSERT ERROR:', insertError.message);
        // Try Service Role if available
        console.log('Trying direct upsert via client...');
        const { data, error: upsertError } = await supabase
            .from('profile_tenants')
            .upsert({
                profile_id: helmerTutorId,
                tenant_id: tenantId,
                role: 'TUTOR'
            }, { onConflict: 'profile_id,tenant_id,role' });
        if (upsertError) console.error('UPSERT ERROR:', upsertError.message);
        else console.log('UPSERT OK:', data);
    } else {
        console.log('INSERT OK');
    }

    // Verify
    const { data: pt } = await supabase.rpc('exec_query', {
        p_sql: `SELECT profile_id, tenant_id, role FROM profile_tenants WHERE profile_id = '${helmerTutorId}'`
    });
    console.log('RESULT:', JSON.stringify(pt, null, 2));
}

run();
