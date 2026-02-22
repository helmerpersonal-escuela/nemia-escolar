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
    const studentId = 'a0f1f865-6389-4da9-b451-b968eb1b3717';
    const tenantId = 'efc61ce1-32c2-47b6-9751-95becd7ddc33';

    // Get full schema
    const { data: cols } = await supabase.rpc('exec_query', {
        p_sql: `SELECT column_name, is_nullable, data_type, column_default FROM information_schema.columns WHERE table_name = 'guardians' ORDER BY ordinal_position`
    });

    // Get sample existing data
    const { data: sample } = await supabase.rpc('exec_query', {
        p_sql: `SELECT * FROM guardians LIMIT 3`
    });

    const result = { schema: cols, sample };
    fs.writeFileSync('scripts/guardians-schema.json', JSON.stringify(result, null, 2));
    console.log('Schema saved to guardians-schema.json');
    console.log('SCHEMA:', JSON.stringify(cols, null, 2));
    console.log('SAMPLE:', JSON.stringify(sample, null, 2));

    // Try insert with just the required fields based on schema
    console.log('\nTrying insert...');

    // First try with profile_id included
    const { error: e1 } = await supabase.rpc('exec_sql', {
        sql_query: `INSERT INTO guardians (profile_id, user_id, student_id, relationship, tenant_id) VALUES ('${helmerTutorId}', '${helmerTutorId}', '${studentId}', 'Padre', '${tenantId}') ON CONFLICT DO NOTHING`
    });
    if (e1) console.error('INSERT WITH PROFILE_ID ERROR:', e1.message);
    else console.log('INSERT WITH PROFILE_ID OK');

    // Check
    const { data: g } = await supabase.rpc('exec_query', {
        p_sql: `SELECT * FROM guardians WHERE user_id = '${helmerTutorId}'`
    });
    console.log('RESULT:', JSON.stringify(g, null, 2));
}

run();
