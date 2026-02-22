import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    console.log('Printing full record for student Helmer...');
    const { data: students, error } = await supabase.rpc('exec_query', {
        p_sql: "SELECT * FROM students WHERE first_name ILIKE '%Helmer%' AND last_name_paternal = 'FERRAS'"
    });

    if (error) {
        console.error(error);
    } else {
        console.log('FULL STUDENT DATA:');
        console.log(JSON.stringify(students, null, 2));
    }
}

run();
