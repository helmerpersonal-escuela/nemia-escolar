import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    const tutorEmail = 'helmerferras@gmail.com';
    const studentId = '8c0a8767-1601-4993-96b6-58673f808381';

    console.log('--- ULTIMATE VERIFICATION ---');

    const { data: tutor } = await supabase.rpc('exec_query', {
        p_sql: `SELECT id, full_name, role FROM profiles WHERE email = '${tutorEmail}'`
    });
    console.log('TUTOR:', JSON.stringify(tutor, null, 2));

    const { data: student } = await supabase.rpc('exec_query', {
        p_sql: `SELECT id, first_name, sex, avatar_url FROM students WHERE id = '${studentId}'`
    });
    console.log('STUDENT:', JSON.stringify(student, null, 2));

    const { data: guardians } = await supabase.rpc('exec_query', {
        p_sql: `SELECT * FROM guardians WHERE user_id = '${tutor?.[0]?.id}' AND student_id = '${studentId}'`
    });
    console.log('GUARDIANSHIP:', JSON.stringify(guardians, null, 2));
}

run();
