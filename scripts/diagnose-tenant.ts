import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    const helmerTutorId = 'ecd127be-a39c-48a9-8661-e50ffb2248fd';
    const tenantId = 'efc61ce1-32c2-47b6-9751-95becd7ddc33';

    // 1. Check profile current state 
    const { data: profile } = await supabase.rpc('exec_query', {
        p_sql: `SELECT id, first_name, role, tenant_id FROM profiles WHERE id = '${helmerTutorId}'`
    });
    console.log('PROFILE:', JSON.stringify(profile, null, 2));

    // 2. Check what tenant profile.tenant_id points to
    if (profile && profile[0]) {
        const tenantOfProfile = profile[0].tenant_id;
        const { data: t } = await supabase.rpc('exec_query', {
            p_sql: `SELECT id, name, type FROM tenants WHERE id = '${tenantOfProfile}'`
        });
        console.log(`PROFILE TENANT (${tenantOfProfile}):`, JSON.stringify(t, null, 2));
    }

    // 3. Check ALL tenants types
    const { data: allTenants } = await supabase.rpc('exec_query', {
        p_sql: `SELECT id, name, type FROM tenants ORDER BY name`
    });
    console.log('ALL TENANTS:', JSON.stringify(allTenants, null, 2));

    // 4. Check profile_tenants for Helmer
    const { data: pt } = await supabase.rpc('exec_query', {
        p_sql: `SELECT profile_id, tenant_id, role FROM profile_tenants WHERE profile_id = '${helmerTutorId}'`
    });
    console.log('PROFILE_TENANTS for Helmer:', JSON.stringify(pt, null, 2));
}

run();
