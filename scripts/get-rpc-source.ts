import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    const { data } = await supabase.rpc('exec_query', {
        p_sql: "SELECT prosrc FROM pg_proc WHERE proname = 'exec_query'"
    });
    console.log('--- EXEC_QUERY SOURCE ---');
    console.log(data?.[0]?.prosrc);
}

run();
