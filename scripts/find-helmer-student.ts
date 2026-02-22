import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    console.log('Searching for student Helmer Ferras Hernandez...');
    const { data: students, error } = await supabase.rpc('exec_query', {
        p_sql: "SELECT id, first_name, last_name_paternal, last_name_maternal, sex, avatar_url, tutor_id FROM students WHERE last_name_paternal = 'FERRAS' AND last_name_maternal = 'HERNANDEZ'"
    });

    if (error) {
        console.error(error);
    } else {
        console.log('STUDENTS FOUND:', JSON.stringify(students, null, 2));
    }
}

run();
