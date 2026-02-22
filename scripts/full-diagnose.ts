import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    const helmerTutorId = 'ecd127be-a39c-48a9-8661-e50ffb2248fd';

    // Full profile dump
    const { data: profile } = await supabase.rpc('exec_query', {
        p_sql: `SELECT * FROM profiles WHERE id = '${helmerTutorId}'`
    });
    console.log('FULL PROFILE:', JSON.stringify(profile, null, 2));

    // All tenants
    const { data: allTenants } = await supabase.rpc('exec_query', {
        p_sql: `SELECT id, name, type FROM tenants`
    });
    console.log('ALL TENANTS:', JSON.stringify(allTenants, null, 2));

    // profile_tenants schema
    const { data: ptSchema } = await supabase.rpc('exec_query', {
        p_sql: `SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'profile_tenants' ORDER BY ordinal_position`
    });
    console.log('PROFILE_TENANTS SCHEMA:', JSON.stringify(ptSchema, null, 2));

    fs.writeFileSync('scripts/diagnose-output.json', JSON.stringify({ profile, allTenants, ptSchema }, null, 2));
    console.log('Saved to diagnose-output.json');
}

run();
