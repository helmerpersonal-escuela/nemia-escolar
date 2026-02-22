import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    console.log('Checking for exec_sql...');
    const { data } = await supabase.rpc('exec_query', {
        p_sql: "SELECT proname FROM pg_proc WHERE proname = 'exec_sql'"
    });
    console.log('Result:', JSON.stringify(data, null, 2));
}

run();
