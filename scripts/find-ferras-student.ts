import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    console.log('Searching for student with Ferras in names...');
    const { data: students, error } = await supabase.rpc('exec_query', {
        p_sql: "SELECT * FROM students WHERE last_name_paternal ILIKE '%Ferras%' OR last_name_maternal ILIKE '%Ferras%' OR first_name ILIKE '%Ferras%'"
    });

    if (error) {
        console.error(error);
    } else {
        console.log('STUDENTS FOUND:', JSON.stringify(students, null, 2));
    }
}

run();
