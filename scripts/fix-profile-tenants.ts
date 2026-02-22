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

    console.log('--- FIXING PROFILE_TENANTS ---');

    // First check what's there
    const { data: existing } = await supabase.rpc('exec_query', {
        p_sql: `SELECT * FROM profile_tenants WHERE profile_id = '${helmerTutorId}'`
    });
    console.log('EXISTING PT:', JSON.stringify(existing, null, 2));

    // Get schema
    const { data: schema } = await supabase.rpc('exec_query', {
        p_sql: `SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'profile_tenants' ORDER BY ordinal_position`
    });
    console.log('PT SCHEMA:', JSON.stringify(schema, null, 2));

    // Get constraints
    const { data: constraints } = await supabase.rpc('exec_query', {
        p_sql: `SELECT conname, pg_get_constraintdef(oid) as def FROM pg_constraint WHERE conrelid = 'profile_tenants'::regclass`
    });
    console.log('PT CONSTRAINTS:', JSON.stringify(constraints, null, 2));

    // Try direct insert
    const { error } = await supabase.rpc('exec_sql', {
        sql_query: `INSERT INTO profile_tenants (profile_id, tenant_id, role, first_name, last_name_paternal, full_name) VALUES ('${helmerTutorId}', '${tenantId}', 'TUTOR', 'HELMER', 'FERRAS', 'HELMER FERRAS COUTIÑO') ON CONFLICT DO NOTHING`
    });
    if (error) console.error('INSERT ERROR:', error.message);
    else console.log('INSERT OK');

    // Verify
    const { data: after } = await supabase.rpc('exec_query', {
        p_sql: `SELECT * FROM profile_tenants WHERE profile_id = '${helmerTutorId}'`
    });
    console.log('PT AFTER:', JSON.stringify(after, null, 2));
}

run();
