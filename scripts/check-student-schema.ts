import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    console.log('Checking student columns...');
    const { data: cols } = await supabase.rpc('exec_query', {
        p_sql: "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'students'"
    });
    console.log('COLUMNS:', JSON.stringify(cols, null, 2));

    console.log('Checking a few students to see the data...');
    const { data: students } = await supabase.rpc('exec_query', {
        p_sql: "SELECT * FROM students LIMIT 5"
    });
    console.log('SAMPLE DATA:', JSON.stringify(students, null, 2));
}

run();
