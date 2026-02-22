import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    console.log('Checking if log_profile_changes exists...');
    const { data } = await supabase.rpc('exec_query', {
        p_sql: "SELECT count(*) FROM pg_proc WHERE proname = 'log_profile_changes'"
    });
    console.log('EXISTS COUNT:', JSON.stringify(data, null, 2));
}

run();
