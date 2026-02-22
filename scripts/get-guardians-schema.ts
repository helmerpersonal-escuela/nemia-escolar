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

    // Get guardians table schema - all columns with nullability
    const { data: cols } = await supabase.rpc('exec_query', {
        p_sql: `
            SELECT column_name, is_nullable, data_type, column_default 
            FROM information_schema.columns 
            WHERE table_name = 'guardians' 
            ORDER BY ordinal_position
        `
    });
    console.log('GUARDIANS SCHEMA:', JSON.stringify(cols, null, 2));

    // Check if there's an existing record
    const { data: existing } = await supabase.rpc('exec_query', {
        p_sql: `SELECT * FROM guardians LIMIT 5`
    });
    console.log('EXISTING GUARDIANS (sample):', JSON.stringify(existing, null, 2));
}

run();
