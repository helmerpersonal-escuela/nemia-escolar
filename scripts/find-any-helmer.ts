import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    console.log('Searching for any student named Helmer...');
    const { data: students, error } = await supabase.rpc('exec_query', {
        p_sql: "SELECT * FROM students WHERE first_name ILIKE '%Helmer%'"
    });

    if (error) {
        console.error(error);
    } else {
        console.log('STUDENTS FOUND:', JSON.stringify(students, null, 2));
    }
}

run();
