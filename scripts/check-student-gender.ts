import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    console.log('Checking student Helmer Ferras Hernandez...');
    const { data: students, error } = await supabase.rpc('exec_query', {
        p_sql: "SELECT id, first_name, last_name_paternal, last_name_maternal, gender, avatar_url FROM students WHERE last_name_paternal = 'FERRAS' AND last_name_maternal = 'HERNANDEZ'"
    });

    if (error) {
        console.log('Error (trying different column name):', error.message);
        const { data: students2 } = await supabase.rpc('exec_query', {
            p_sql: "SELECT id, first_name, last_name_paternal, last_name_maternal, avatar_url FROM students WHERE last_name_paternal = 'FERRAS' AND last_name_maternal = 'HERNANDEZ'"
        });
        console.log('STUDENT DATA (no gender col):', JSON.stringify(students2, null, 2));
    } else {
        console.log('STUDENT DATA:', JSON.stringify(students, null, 2));
    }
}

run();
