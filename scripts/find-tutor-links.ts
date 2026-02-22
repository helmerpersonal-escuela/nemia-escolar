import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    console.log('Searching for any student with a tutor...');
    const { data: studentsWithTutors } = await supabase.rpc('exec_query', {
        p_sql: `
            SELECT s.id, s.first_name, s.last_name, s.tutor_id, p.email as tutor_email, p.full_name as tutor_name
            FROM students s
            JOIN profiles p ON s.tutor_id = p.id
            WHERE s.tutor_id IS NOT NULL
        `
    });
    console.log('STUDENTS WITH TUTORS:', JSON.stringify(studentsWithTutors, null, 2));

    console.log('Searching for students with full_name including "Ferras"...');
    const { data: ferrasStudents } = await supabase.rpc('exec_query', {
        p_sql: "SELECT id, first_name, last_name, tutor_id FROM students WHERE last_name ILIKE '%Ferras%'"
    });
    console.log('FERRAS STUDENTS:', JSON.stringify(ferrasStudents, null, 2));

    if (ferrasStudents && ferrasStudents.length > 0) {
        for (const s of ferrasStudents) {
            if (s.tutor_id) {
                const { data: tutorProfile } = await supabase.rpc('exec_query', {
                    p_sql: `SELECT id, email, full_name, role FROM profiles WHERE id = '${s.tutor_id}'`
                });
                console.log(`Tutor for ${s.first_name} ${s.last_name}:`, JSON.stringify(tutorProfile, null, 2));
            } else {
                console.log(`Student ${s.first_name} ${s.last_name} has NO tutor_id.`);
            }
        }
    }
}

run();
