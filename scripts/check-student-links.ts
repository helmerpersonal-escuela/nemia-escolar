import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    const userId = '85870a47-4730-401d-a96c-a3712e821b3d';
    console.log(`Checking students for tutor ID: ${userId}...`);

    const { data: students, error } = await supabase.rpc('exec_query', {
        p_sql: `SELECT id, first_name, last_name, tutor_id, tenant_id FROM students WHERE tutor_id = '${userId}'`
    });

    if (error) console.error(error);
    else console.log('LINKED STUDENTS:', JSON.stringify(students, null, 2));

    // Also check student_tutors table if it exists
    const { data: hasStTable } = await supabase.rpc('exec_query', {
        p_sql: "SELECT count(*) FROM information_schema.tables WHERE table_name = 'student_tutors'"
    });

    if (hasStTable && parseInt(hasStTable[0].count) > 0) {
        const { data: st } = await supabase.rpc('exec_query', {
            p_sql: `SELECT * FROM student_tutors WHERE profile_id = '${userId}'`
        });
        console.log('STUDENT_TUTORS ENTRIES:', JSON.stringify(st, null, 2));
    }
}

run();
