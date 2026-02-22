import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    const helmerTutorId = 'ecd127be-a39c-48a9-8661-e50ffb2248fd';
    const studentId = 'a0f1f865-6389-4da9-b451-b968eb1b3717';
    const tenantId = 'efc61ce1-32c2-47b6-9751-95becd7ddc33';

    // Get guardians table schema
    const { data: cols } = await supabase.rpc('exec_query', {
        p_sql: "SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'guardians' ORDER BY ordinal_position"
    });
    console.log('GUARDIANS COLUMNS:', JSON.stringify(cols, null, 2));

    // Get constraints
    const { data: constraints } = await supabase.rpc('exec_query', {
        p_sql: "SELECT conname, pg_get_constraintdef(oid) as def FROM pg_constraint WHERE conrelid = 'guardians'::regclass"
    });
    console.log('GUARDIANS CONSTRAINTS:', JSON.stringify(constraints, null, 2));

    // Try minimal insert
    console.log('\nTrying minimal insert...');
    const { error: insertError } = await supabase.rpc('exec_sql', {
        sql_query: `INSERT INTO guardians (user_id, student_id, relationship, tenant_id) VALUES ('${helmerTutorId}', '${studentId}', 'Padre', '${tenantId}')`
    });
    if (insertError) {
        console.error('MINIMAL INSERT ERROR:', insertError.message);
    } else {
        console.log('MINIMAL INSERT OK');
    }

    // Check result
    const { data: g } = await supabase.rpc('exec_query', {
        p_sql: `SELECT * FROM guardians WHERE user_id = '${helmerTutorId}'`
    });
    console.log('GUARDIANS AFTER INSERT:', JSON.stringify(g, null, 2));
}

run();
