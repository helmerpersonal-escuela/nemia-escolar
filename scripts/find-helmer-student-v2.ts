import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    console.log('Finding student Helmer Ferras Hernandez...');
    const { data: students, error } = await supabase.rpc('exec_query', {
        p_sql: "SELECT * FROM students WHERE last_name_paternal = 'FERRAS' AND last_name_maternal = 'HERNANDEZ' LIMIT 1"
    });

    if (error) {
        console.error(error);
    } else {
        console.log('STUDENT DATA:', JSON.stringify(students, null, 2));
    }
}

run();
