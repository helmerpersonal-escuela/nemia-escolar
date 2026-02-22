import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    console.log('Checking log_profile_changes source...');
    const { data, error } = await supabase.rpc('exec_query', {
        p_sql: "SELECT prosrc FROM pg_proc WHERE proname = 'log_profile_changes'"
    });
    if (error) console.error(error);
    else console.log('SOURCE:', data[0].prosrc);
}

run();
